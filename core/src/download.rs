//! Publish server-authored M3U and analysis reports under a native-selected download directory.
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
    publish_named(folder, id, "m3u", content.as_bytes())
}
fn publish_named(
    folder: &Path,
    stem: &str,
    extension: &str,
    content: &[u8],
) -> Result<PathBuf, String> {
    fs::create_dir_all(folder)
        .map_err(|_| "Dossier de téléchargement inaccessible.".to_string())?;
    for attempt in 0..1000 {
        let filename = if attempt == 0 {
            format!("{stem}.{extension}")
        } else {
            format!("{stem}-{attempt}.{extension}")
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
            .write_all(content)
            .and_then(|()| file.sync_all())
            .is_err()
        {
            drop(file);
            let _ = fs::remove_file(&path);
            return Err("Téléchargement interrompu.".into());
        }
        return Ok(path);
    }
    Err("Trop de copies de ce fichier existent dans les téléchargements.".into())
}
/// Save a validated server-authored FlacCompagnon report; paths in the JSON are data only.
pub fn publish_analysis(
    folder: &Path,
    reference: &str,
    response: &Value,
) -> Result<PathBuf, String> {
    use std::hash::{Hash, Hasher};
    if reference.len() > 4096
        || !["track:", "release:"].iter().any(|kind| {
            reference
                .strip_prefix(kind)
                .is_some_and(|value| !value.is_empty())
        })
    {
        return Err("Référence d’analyse invalide.".into());
    }
    let files = response["report"]["files"]
        .as_array()
        .filter(|files| !files.is_empty() && files.len() <= 2048)
        .ok_or("Rapport d’analyse incomplet.")?;
    if response["format"] != "flaccompagnon-report"
        || !response["version"]
            .as_u64()
            .is_some_and(|version| version <= 1)
        || !response["report"]["root"].is_string()
        || !response["report"]["has_flac"].is_boolean()
        || files.iter().any(|file| !file["path"].is_string())
    {
        return Err("Rapport FlacCompagnon invalide.".into());
    }
    let content = serde_json::to_vec_pretty(response).map_err(|_| "Rapport d’analyse invalide.")?;
    if content.len() > 16 * 1024 * 1024 {
        return Err("Rapport d’analyse trop volumineux.".into());
    }
    let mut hash = std::collections::hash_map::DefaultHasher::new();
    reference.hash(&mut hash);
    let kind = if reference.starts_with("track:") {
        "titre"
    } else {
        "album"
    };
    publish_named(
        folder,
        &format!("flaccompagnon-{kind}-{:016x}", hash.finish()),
        "json",
        &content,
    )
}
/// Save only server-selected spectrum bytes; the webview cannot choose a filename or path.
pub fn publish_spectrum(folder: &Path, reference: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    use std::hash::{Hash, Hasher};
    if reference.len() > 4096
        || !reference
            .strip_prefix("track:")
            .is_some_and(|s| !s.is_empty())
    {
        return Err("Référence de spectre invalide.".into());
    }
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("Spectre trop volumineux.".into());
    }
    let extension = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        "png"
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        "jpg"
    } else {
        return Err("Format de spectre invalide.".into());
    };
    let mut hash = std::collections::hash_map::DefaultHasher::new();
    reference.hash(&mut hash);
    publish_named(
        folder,
        &format!("spectre-{:016x}", hash.finish()),
        extension,
        bytes,
    )
}
#[cfg(test)]
#[path = "download_tests.rs"]
mod tests;
