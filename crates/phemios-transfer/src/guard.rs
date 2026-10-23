//! Retained filesystem admission; remote path hints are not authoritative local roots.
use crate::Mounted;
use std::{
    collections::BTreeSet,
    fs,
    path::{Component, Path, PathBuf},
};

const OVERLAP: &str = "Choisissez un lecteur qui ne contient aucun dossier de la bibliothèque.";
const CHANGED: &str = "Les dossiers de la bibliothèque ont changé. Recréez l’aperçu du transfert.";

struct LocalRoot {
    path: PathBuf,
    resolved: PathBuf,
    present: bool,
    anchor: Option<Mounted>,
}
fn overlaps(a: &Path, b: &Path) -> bool {
    #[cfg(windows)]
    let (lower_a, lower_b) = (
        PathBuf::from(a.to_string_lossy().to_lowercase()),
        PathBuf::from(b.to_string_lossy().to_lowercase()),
    );
    #[cfg(windows)]
    let (a, b) = (lower_a.as_path(), lower_b.as_path());
    a.starts_with(b) || b.starts_with(a)
}
impl LocalRoot {
    fn capture(path: PathBuf) -> Result<Self, String> {
        if !path.is_absolute()
            || path
                .to_str()
                .is_none_or(|s| s.len() > 4096 || s.contains('\0'))
            || path
                .components()
                .any(|part| matches!(part, Component::ParentDir))
        {
            return Err("Dossier local de bibliothèque invalide.".into());
        }
        let mut parent = path.as_path();
        let mut missing = Vec::new();
        loop {
            match parent.canonicalize() {
                Ok(canonical) => {
                    let anchor = Mounted::capture(canonical.clone())?;
                    let present = missing.is_empty();
                    let resolved = missing.iter().rev().fold(canonical, |p, part| p.join(part));
                    return Ok(Self {
                        path,
                        resolved,
                        present,
                        anchor: Some(anchor),
                    });
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    // An unreadable/dangling symlink is ambiguous, not an absent directory.
                    match fs::symlink_metadata(parent) {
                        Ok(_) => return Err(CHANGED.into()),
                        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                        Err(_) => return Err(CHANGED.into()),
                    }
                    let Some(name) = parent.file_name() else {
                        // An unavailable Windows drive can be retained while disjoint.
                        return Ok(Self {
                            resolved: path.clone(),
                            path,
                            present: false,
                            anchor: None,
                        });
                    };
                    missing.push(name.to_owned());
                    parent = parent.parent().ok_or(CHANGED)?;
                }
                Err(_) => return Err(CHANGED.into()),
            }
        }
    }
    fn confirm(&self, target: &Path) -> Result<(), String> {
        let current = Self::capture(self.path.clone())?;
        if overlaps(target, &current.resolved) {
            return Err(OVERLAP.into());
        }
        if current.resolved != self.resolved || current.present != self.present {
            return Err(CHANGED.into());
        }
        if let Some(anchor) = &self.anchor {
            anchor.confirm()?;
        }
        Ok(())
    }
}

/// Binds a mounted destination to authoritative local roots and retained remote hints.
/// Recheck before each write operation; this is metadata admission, not atomic OS confinement.
pub struct DestinationGuard {
    mount: Mounted,
    local: Vec<LocalRoot>,
    remote: Vec<String>,
}
impl DestinationGuard {
    /// Refuse even unavailable local roots that project inside/around the destination.
    /// Remote paths may belong to another OS; unavailable hints remain inert until resolvable.
    pub fn capture(mount: &Mounted, local: &[PathBuf], remote: &[String]) -> Result<Self, String> {
        if local.len() > 4096
            || remote.len() > 4096
            || remote.iter().any(|s| s.len() > 4096 || s.contains('\0'))
        {
            return Err("Racines de transfert invalides.".into());
        }
        let local = local
            .iter()
            .cloned()
            .collect::<BTreeSet<_>>()
            .into_iter()
            .map(LocalRoot::capture)
            .collect::<Result<Vec<_>, _>>()?;
        let guard = Self {
            mount: mount.clone(),
            local,
            remote: remote
                .iter()
                .cloned()
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect(),
        };
        guard.confirm()?;
        Ok(guard)
    }
    /// Retire an old grant after local-root availability/identity or remote overlap changes.
    pub fn confirm(&self) -> Result<(), String> {
        self.mount.confirm()?;
        let target = self.mount.path().canonicalize().map_err(|_| CHANGED)?;
        for root in &self.local {
            root.confirm(&target)?;
        }
        self.mount.outside(&self.remote)
    }
}

#[cfg(test)]
#[path = "guard_tests.rs"]
mod tests;
