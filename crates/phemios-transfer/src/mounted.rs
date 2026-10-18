//! A selected mount must remain the same directory and filesystem throughout a job.
use std::{
    fs,
    path::{Path, PathBuf},
};
/// Retained identity of a previously discovered mounted root; no mount or format operation.
#[derive(Clone)]
pub struct Mounted {
    path: PathBuf,
    identity: Identity,
    ipod: bool,
    rockbox: bool,
}
#[derive(Clone, PartialEq, Eq)]
struct Identity {
    #[cfg(unix)]
    dev: u64,
    #[cfg(unix)]
    ino: u64,
    #[cfg(not(unix))]
    created: Option<std::time::SystemTime>,
}
fn identity(path: &Path) -> Result<Identity, String> {
    let metadata =
        fs::symlink_metadata(path).map_err(|_| "Le lecteur a été débranché ou démonté.")?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err("Destination montée invalide.".into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        Ok(Identity {
            dev: metadata.dev(),
            ino: metadata.ino(),
        })
    }
    #[cfg(not(unix))]
    {
        Ok(Identity {
            created: metadata.created().ok(),
        })
    }
}
impl Mounted {
    /// Capture an OS-discovered root, refusing symbolic links and unavailable mounts.
    pub fn capture(path: PathBuf) -> Result<Self, String> {
        let stamp = identity(&path)?;
        let ipod = path.join("iPod_Control").is_dir();
        let rockbox = path.join(".rockbox").is_dir();
        Ok(Self {
            path,
            identity: stamp,
            ipod,
            rockbox,
        })
    }
    /// Native destination root; never obtained directly from a webview argument.
    pub fn path(&self) -> &Path {
        &self.path
    }
    /// Apple databases require their dedicated adapter; Rockbox uses ordinary files.
    pub fn apple_ipod(&self) -> bool {
        self.ipod && !self.rockbox
    }
    /// Refuse a detached/replaced mount, including an empty directory left after unmounting.
    pub fn confirm(&self) -> Result<(), String> {
        if identity(&self.path)? != self.identity {
            return Err("Le lecteur a changé. Actualisez la détection.".into());
        }
        Ok(())
    }
    /// Refuse a destination overlapping a library root, in either direction.
    pub fn outside(&self, roots: &[String]) -> Result<(), String> {
        self.confirm()?;
        let target = self
            .path
            .canonicalize()
            .map_err(|_| "Destination indisponible.")?;
        for root in roots {
            if let Ok(root) = Path::new(root).canonicalize()
                && (target.starts_with(&root) || root.starts_with(&target))
            {
                return Err(
                    "Choisissez un lecteur qui ne contient aucun dossier de la bibliothèque."
                        .into(),
                );
            }
        }
        Ok(())
    }
}
#[cfg(test)]
#[path = "mounted_tests.rs"]
mod tests;
