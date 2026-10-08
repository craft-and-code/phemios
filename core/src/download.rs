//! Publish a server-authored M3U under a native-selected download directory.
use serde_json::Value;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
/// No client path or filename is accepted; repeats never replace an existing file.
pub fn publish(folder: &Path, id: &str, response: &Value) -> Result<PathBuf, String> {
    if !id.strip_prefix("playlist-").is_some_and(|value| {
        value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
    }) || response["id"].as_str() != Some(id)
    {
        return Err("Identité de M3U invalide.".into());
    }
    let content = response["content"]
        .as_str()
        .filter(|value| value.starts_with("#EXTM3U") && value.len() <= 8 * 1024 * 1024)
        .ok_or("Contenu M3U invalide.")?;
    fs::create_dir_all(folder)
        .map_err(|_| "Dossier de téléchargement inaccessible.".to_string())?;
    for attempt in 0..1000 {
        let filename = if attempt == 0 {
            format!("{id}.m3u")
        } else {
            format!("{id}-{attempt}.m3u")
        };
        let path = folder.join(filename);
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = match options.open(&path) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(_) => return Err("Téléchargement impossible.".into()),
        };
        if file
            .write_all(content.as_bytes())
            .and_then(|()| file.sync_all())
            .is_err()
        {
            drop(file);
            let _ = fs::remove_file(&path);
            return Err("Téléchargement interrompu.".into());
        }
        return Ok(path);
    }
    Err("Trop de copies de cette liste existent dans les téléchargements.".into())
}
#[cfg(test)]
#[path = "download_tests.rs"]
mod tests;
