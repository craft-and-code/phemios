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
/// Save an existing folder M3U verbatim under an opaque native-selected name.
/// References remain inert; even an unsafe server filename cannot choose the destination.
pub fn publish_library_m3u(folder: &Path, id: &str, response: &Value) -> Result<PathBuf, String> {
    if !id.strip_prefix("m3u-file-").is_some_and(|value| {
        value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
    }) || response["id"].as_str() != Some(id)
    {
        return Err("Identité de M3U invalide.".into());
    }
    let filename = response["filename"]
        .as_str()
        .ok_or("Contenu M3U invalide.")?
        .to_ascii_lowercase();
    let extension = if filename.ends_with(".m3u8") {
        "m3u8"
    } else if filename.ends_with(".m3u") {
        "m3u"
    } else {
        return Err("Contenu M3U invalide.".into());
    };
    let content = response["content"]
        .as_str()
        .filter(|value| value.len() <= 8 * 1024 * 1024 && !value.contains('\0'))
        .ok_or("Contenu M3U invalide.")?;
    let entries = content
        .trim_start_matches('\u{feff}')
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .count();
    if entries > 4096 || response["track_count"].as_u64() != Some(entries as u64) {
        return Err("Contenu M3U invalide.".into());
    }
    publish_named(folder, id, extension, content.as_bytes())
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

/// Publish one attributed Wikipedia text document under a fixed language/page identity.
/// No executable format, caller-selected path or filename, or overwrite is admitted.
pub fn publish_wikipedia(
    folder: &Path,
    language: &str,
    page_id: u64,
    document: &str,
) -> Result<PathBuf, String> {
    if !matches!(language, "fr" | "en")
        || page_id == 0
        || page_id > 9_007_199_254_740_991
        || document.len() > 1024 * 1024
        || !document.starts_with(&format!(
            "\u{feff}Wikipédia · {} · {page_id}\n",
            language.to_uppercase()
        ))
        || document
            .chars()
            .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
    {
        return Err("Document Wikipédia invalide ou trop volumineux.".into());
    }
    publish_named(
        folder,
        &format!("wikipedia-{language}-{page_id}"),
        "txt",
        document.as_bytes(),
    )
}

/// Export only the exact owner's server-confirmed Markdown note with collision-safe publication.
/// Caller titles and paths never choose the destination; unsaved UI drafts are not accepted.
pub fn publish_note(
    folder: &Path,
    reference: &str,
    response: &Value,
    detail: &Value,
) -> Result<PathBuf, String> {
    if reference.len() > 4096
        || !["artist:", "release:", "track:"].iter().any(|prefix| {
            reference
                .strip_prefix(prefix)
                .is_some_and(|value| !value.is_empty())
        })
        || response["reference"].as_str() != Some(reference)
        || response["annotation"]["reference"].as_str() != Some(reference)
        || detail["reference"].as_str() != Some(reference)
    {
        return Err("Identité de note personnelle invalide.".into());
    }
    let note = response["annotation"]["note"]
        .as_str()
        .filter(|text| !text.trim().is_empty() && text.len() <= 1024 * 1024 && !text.contains('\0'))
        .ok_or("Aucune note personnelle disponible à télécharger.")?;
    let field = if reference.starts_with("artist:") {
        "name"
    } else {
        "title"
    };
    let title = detail[field]
        .as_str()
        .filter(|title| !title.trim().is_empty() && title.len() <= 4096)
        .ok_or("Nom de note personnelle invalide.")?;
    // Bound UTF-8 bytes rather than characters, including non-Latin catalogue names.
    let mut safe_title = String::new();
    for character in title.chars() {
        let character = if character.is_alphanumeric()
            || matches!(character, ' ' | '-' | '_' | '(' | ')' | '\'')
        {
            character
        } else {
            '-'
        };
        if safe_title.len() + character.len_utf8() > 180 {
            break;
        }
        safe_title.push(character);
    }
    let title = safe_title.trim_matches([' ', '-']);
    if title.is_empty() {
        return Err("Nom de note personnelle invalide.".into());
    }
    publish_named(folder, &format!("Note-{title}"), "md", note.as_bytes())
}
