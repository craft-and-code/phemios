//! Disposable public library/artwork cache; never stores credentials or annotations.
use serde_json::Value;
use std::fs::{self, OpenOptions};
use std::hash::{Hash, Hasher};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
pub(crate) const MAX_CATALOG: u64 = 100 * 1024 * 1024;
const MAX_IMAGE: u64 = 32 * 1024 * 1024;
/// Application-owned paths. No path supplied by the webview is accepted.
#[derive(Clone)]
pub struct Cache {
    root: PathBuf,
}
impl Cache {
    /// Construct an isolated cache location without modifying existing files.
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }
    /// A missing cache is distinct from an unreadable or incompatible cache.
    pub fn load(&self) -> Result<Option<Value>, String> {
        let path = self.root.join("catalog.json");
        let Some(bytes) = read(&path, MAX_CATALOG)? else {
            return Ok(None);
        };
        let snapshot: Value = serde_json::from_slice(&bytes).map_err(|_| {
            "Le cache du catalogue est illisible. Relancez explicitement une synchronisation."
                .to_string()
        })?;
        validate(&snapshot)?;
        Ok(Some(snapshot))
    }
    /// Atomically publish a complete library snapshot after explicit synchronization.
    pub fn save(&self, mut snapshot: Value) -> Result<Value, String> {
        validate(&snapshot)?;
        snapshot["cachedAt"] = Value::from(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|_| "Horloge système invalide.")?
                .as_millis()
                .to_string(),
        );
        let bytes = serde_json::to_vec(&snapshot)
            .map_err(|_| "Catalogue impossible à enregistrer.".to_string())?;
        if bytes.len() as u64 > MAX_CATALOG {
            return Err("Catalogue trop grand pour ce cache.".into());
        }
        write_atomic(&self.root.join("catalog.json"), &bytes)?;
        Ok(snapshot)
    }
    /// Read already synchronized art; missing art may then be requested explicitly.
    pub fn image(
        &self,
        snapshot: &Value,
        reference: &str,
        kind: &str,
    ) -> Result<Option<Vec<u8>>, String> {
        read(&self.image_path(snapshot, reference, kind), MAX_IMAGE)
    }
    /// Keep validated server art in an catalog-version/account/authority-specific namespace.
    pub fn save_image(
        &self,
        snapshot: &Value,
        reference: &str,
        kind: &str,
        bytes: &[u8],
    ) -> Result<(), String> {
        if bytes.len() as u64 > MAX_IMAGE {
            return Err("Image trop grande pour le cache.".into());
        }
        write_atomic(&self.image_path(snapshot, reference, kind), bytes)
    }
    fn image_path(&self, snapshot: &Value, reference: &str, kind: &str) -> PathBuf {
        let mut hash = std::collections::hash_map::DefaultHasher::new();
        for value in [
            snapshot["server"].to_string(),
            snapshot["accountId"].to_string(),
            snapshot["scannedAt"].to_string(),
            reference.to_owned(),
            kind.to_owned(),
        ] {
            value.hash(&mut hash);
        }
        self.root
            .join("artwork")
            .join(format!("{:016x}.image", hash.finish()))
    }
}
fn validate(snapshot: &Value) -> Result<(), String> {
    if !snapshot["artists"].is_array()
        || !snapshot["albums"].is_array()
        || snapshot["server"].as_str().is_none()
        || snapshot["accountId"].as_str().is_none()
    {
        Err("Format de cache incompatible.".into())
    } else {
        Ok(())
    }
}
fn read(path: &Path, limit: u64) -> Result<Option<Vec<u8>>, String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("Cache inaccessible.".into()),
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > limit {
        return Err("Cache invalide ou trop grand.".into());
    }
    let file = fs::File::open(path).map_err(|_| "Cache inaccessible.".to_string())?;
    let mut bytes = Vec::new();
    file.take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Lecture du cache interrompue.".to_string())?;
    if bytes.len() as u64 > limit {
        return Err("Cache trop grand.".into());
    }
    Ok(Some(bytes))
}
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    static NEXT: AtomicU64 = AtomicU64::new(1);
    let folder = path.parent().ok_or("Emplacement du cache invalide.")?;
    fs::create_dir_all(folder).map_err(|_| "Dossier du cache inaccessible.".to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(folder, fs::Permissions::from_mode(0o700))
            .map_err(|_| "Permissions du cache inaccessibles.".to_string())?;
    }
    let temporary = folder.join(format!(
        ".cache-{}-{}.tmp",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&temporary, path)
    })()
    .map_err(|_: std::io::Error| "Enregistrement du cache impossible.".to_string());
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}
#[cfg(test)]
#[path = "cache_tests.rs"]
mod tests;
