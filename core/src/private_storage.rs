//! Shared admission for app-owned private directories; existing objects are never repaired.
use std::fs;
use std::path::Path;

pub(crate) fn validate_root(root: &Path) -> Result<(), String> {
    let meta = match fs::symlink_metadata(root) {
        Ok(meta) => meta,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(_) => return Err("Dossier local inaccessible.".into()),
    };
    if !meta.is_dir() {
        return Err("Dossier local inaccessible.".into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if meta.permissions().mode() & 0o022 != 0 {
            return Err(
                "Les permissions de la configuration locale ne protègent pas ses secrets.".into(),
            );
        }
    }
    Ok(())
}

pub(crate) fn create_root(root: &Path) -> Result<(), String> {
    validate_root(root)?;
    let mut directory = fs::DirBuilder::new();
    directory.recursive(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        directory.mode(0o700);
    }
    directory
        .create(root)
        .map_err(|_| "Dossier local inaccessible.")?;
    validate_root(root)
}
