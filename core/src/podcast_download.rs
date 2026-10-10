//! Streaming publication of explicitly requested public podcast episodes.
use crate::podcast::{PublicResolver, feed_address};
use std::{
    fs,
    io::{self, Read},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::Duration,
};
use ureq::{http::Uri, unversioned::transport::DefaultConnector};
const MAX_EPISODE: u64 = 1024 * 1024 * 1024;
/// Download one public enclosure into the native-owned podcast directory, without session headers.
pub fn download_episode(folder: &Path, url: &str, title: &str) -> Result<PathBuf, String> {
    let config = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(1200)))
        .timeout_connect(Some(Duration::from_secs(15)))
        .max_redirects(5)
        .proxy(None)
        .build();
    let agent = ureq::Agent::with_parts(config, DefaultConnector::default(), PublicResolver);
    download_with(&agent, folder, url, title)
}
fn download_with(
    agent: &ureq::Agent,
    folder: &Path,
    url: &str,
    title: &str,
) -> Result<PathBuf, String> {
    let uri = feed_address(url).map_err(|_| "Adresse podcast invalide.")?;
    if title.len() > 2048 {
        return Err("Titre de podcast invalide.".into());
    }
    let mut response = agent
        .get(uri.to_string())
        .header("User-Agent", "Phemios/0.1.0 (Podcast download)")
        .header("Accept-Encoding", "identity")
        .call()
        .map_err(|_| "Épisode indisponible ou adresse non publique.")?;
    if response.status() != ureq::http::StatusCode::OK {
        return Err("Épisode indisponible ou adresse non publique.".into());
    }
    let mime = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let extension = media_extension(mime, &uri)?;
    if response
        .headers()
        .get("content-encoding")
        .is_some_and(|value| value != "identity")
    {
        return Err("Format de téléchargement du podcast non pris en charge.".into());
    }
    let length = response
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok());
    if length.is_some_and(|value| value == 0 || value > MAX_EPISODE) {
        return Err("Épisode vide ou trop volumineux (limite : 1 Go).".into());
    }
    publish_episode(
        folder,
        title,
        extension,
        response.body_mut().as_reader(),
        length,
        MAX_EPISODE,
    )
}
fn media_extension<'a>(mime: &str, uri: &'a Uri) -> Result<&'a str, String> {
    match mime
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "audio/mpeg" | "audio/mp3" => Ok("mp3"),
        "audio/mp4" | "audio/x-m4a" => Ok("m4a"),
        "video/mp4" => Ok("mp4"),
        "audio/ogg" | "application/ogg" => Ok("ogg"),
        "audio/opus" => Ok("opus"),
        "audio/aac" | "audio/aacp" => Ok("aac"),
        "audio/wav" | "audio/x-wav" => Ok("wav"),
        "audio/flac" | "audio/x-flac" => Ok("flac"),
        "" | "application/octet-stream" | "binary/octet-stream" => {
            let extension = uri.path().rsplit('.').next().unwrap_or("");
            if [
                "mp3", "m4a", "mp4", "ogg", "oga", "opus", "aac", "wav", "flac",
            ]
            .contains(&extension)
            {
                Ok(extension)
            } else {
                Err("Format de téléchargement du podcast non pris en charge.".into())
            }
        }
        _ => Err("Format de téléchargement du podcast non pris en charge.".into()),
    }
}
fn publish_episode(
    folder: &Path,
    title: &str,
    extension: &str,
    reader: impl Read,
    expected: Option<u64>,
    limit: u64,
) -> Result<PathBuf, String> {
    static NEXT: AtomicU64 = AtomicU64::new(0);
    fs::create_dir_all(folder).map_err(|_| "Dossier de téléchargement inaccessible.")?;
    let stem: String = title
        .chars()
        .take(80)
        .map(|ch| {
            if ch.is_alphanumeric() || matches!(ch, ' ' | '-' | '_') {
                ch
            } else {
                '-'
            }
        })
        .collect();
    let stem = stem.trim_matches([' ', '-', '_']);
    let stem = if stem.is_empty() { "podcast" } else { stem };
    let temporary = folder.join(format!(
        ".phemios-podcast-{}-{}.part",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(&temporary)
        .map_err(|_| "Téléchargement impossible.")?;
    let result = (|| {
        let count = io::copy(&mut reader.take(limit.saturating_add(1)), &mut file)
            .map_err(|_| "Téléchargement interrompu.")?;
        if count == 0 || count > limit || expected.is_some_and(|length| length != count) {
            return Err("Épisode incomplet ou trop volumineux (limite : 1 Go).".into());
        }
        file.sync_all().map_err(|_| "Téléchargement interrompu.")?;
        drop(file);
        for attempt in 0..1000 {
            let suffix = if attempt == 0 {
                String::new()
            } else {
                format!("-{attempt}")
            };
            let path = folder.join(format!("{stem}{suffix}.{extension}"));
            match fs::hard_link(&temporary, &path) {
                Ok(()) => return Ok(path),
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
                Err(_) => return Err("Téléchargement impossible.".into()),
            }
        }
        Err("Trop de copies de cet épisode existent.".into())
    })();
    let _ = fs::remove_file(&temporary);
    result
}
#[cfg(test)]
#[path = "podcast_download_tests.rs"]
mod tests;
