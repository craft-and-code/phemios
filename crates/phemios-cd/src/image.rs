//! Selected CUE audio-image sources retain read-only handles; no image mounting or whole-file PCM allocation.
use super::{Disc, FRAMES_PER_SECTOR, Track, ape, cue, decoded};
use std::{
    collections::BTreeMap,
    fs::File,
    io::Read,
    path::{Component, Path},
    sync::{Arc, Mutex},
    time::SystemTime,
};
struct Binary {
    extension: String,
    length: u64,
    path: std::path::PathBuf,
    created: Option<SystemTime>,
    identity: Option<(u64, u64)>,
    file: Mutex<File>,
    start: u32,
    sectors: u32,
    modified: Option<SystemTime>,
}
pub(super) struct Image {
    pub path: std::path::PathBuf,
    files: Vec<Binary>,
    pub title: Option<String>,
    pub performer: Option<String>,
    pub names: BTreeMap<u8, (Option<String>, Option<String>)>,
}
#[cfg(unix)]
fn identity(meta: &std::fs::Metadata) -> Option<(u64, u64)> {
    use std::os::unix::fs::MetadataExt;
    Some((meta.dev(), meta.ino()))
}
#[cfg(not(unix))]
fn identity(_meta: &std::fs::Metadata) -> Option<(u64, u64)> {
    None
}
impl Image {
    pub(super) fn same(&self, other: &Self) -> bool {
        self.path == other.path
            && self.title == other.title
            && self.performer == other.performer
            && self.names == other.names
            && self.files.len() == other.files.len()
            && self.files.iter().zip(&other.files).all(|(a, b)| {
                a.path == b.path
                    && a.created == b.created
                    && a.identity == b.identity
                    && a.extension == b.extension
                    && a.length == b.length
                    && a.start == b.start
                    && a.sectors == b.sectors
                    && a.modified == b.modified
            })
    }
    pub(super) fn open(path: &Path, token: String) -> Result<Disc, String> {
        if !path
            .extension()
            .is_some_and(|e| e.eq_ignore_ascii_case("cue"))
        {
            return Err("Choisissez un fichier CUE.".into());
        }
        let canonical = path.canonicalize().map_err(|_| "Fichier CUE illisible.")?;
        let parent = canonical.parent().ok_or("Fichier CUE invalide.")?;
        let mut text = String::new();
        if !canonical
            .metadata()
            .map_err(|_| "Fichier CUE illisible.")?
            .is_file()
        {
            return Err("Fichier CUE invalide.".into());
        }
        let file = File::open(&canonical).map_err(|_| "Fichier CUE illisible.")?;
        if !file
            .metadata()
            .map_err(|_| "Fichier CUE illisible.")?
            .is_file()
        {
            return Err("Fichier CUE invalide.".into());
        }
        file.take(262145)
            .read_to_string(&mut text)
            .map_err(|_| "Fichier CUE illisible : encodage UTF-8 requis.")?;
        if text.len() > 262144 {
            return Err("Fichier CUE trop volumineux.".into());
        }
        let sheet = cue::parse(&text)?;
        let mut files = Vec::new();
        let mut total = 0u32;
        for name in &sheet.files {
            // Refuse absolute paths, drive/UNC prefixes and parent traversal on every host.
            let normalized = name.replace('\\', "/");
            let relative = Path::new(&normalized);
            if normalized.contains(':')
                || relative.is_absolute()
                || relative
                    .components()
                    .any(|c| !matches!(c, Component::Normal(_) | Component::CurDir))
                || !relative.extension().is_some_and(|e| {
                    e.to_str().is_some_and(|e| {
                        ["bin", "flac", "wav", "ape"].contains(&e.to_ascii_lowercase().as_str())
                    })
                })
            {
                return Err(
                    "Le fichier CUE doit référencer des fichiers audio dans son propre dossier."
                        .into(),
                );
            }
            let resolved = parent
                .join(relative)
                .canonicalize()
                .map_err(|_| "Un fichier audio est absent ou inaccessible.")?;
            if !resolved.starts_with(parent) {
                return Err(
                    "Le fichier CUE doit référencer des fichiers audio dans son propre dossier."
                        .into(),
                );
            }
            if !resolved
                .metadata()
                .map_err(|_| "Fichier audio illisible.")?
                .is_file()
            {
                return Err("Fichier audio illisible.".into());
            }
            let file = File::open(&resolved)
                .map_err(|_| "Un fichier audio est absent ou inaccessible.")?;
            let meta = file.metadata().map_err(|_| "Fichier audio illisible.")?;
            if !meta.is_file() || meta.len() == 0 {
                return Err(
                    "Taille du fichier BIN invalide : secteurs audio de 2352 octets requis.".into(),
                );
            }
            let extension = relative
                .extension()
                .and_then(|e| e.to_str())
                .ok_or(decoded::INVALID)?
                .to_ascii_lowercase();
            let sectors = match extension.as_str() {
                "bin" if meta.len() % 2352 == 0 && meta.len() / 2352 <= 540000 => {
                    (meta.len() / 2352) as u32
                }
                "flac" | "wav" => decoded::sectors(
                    decoded::Decoded::open(
                        file.try_clone().map_err(|_| decoded::INVALID)?,
                        &extension,
                    )?
                    .frames,
                )?,
                "ape" => decoded::sectors(ape::frames(&file)?)?,
                _ => return Err(decoded::INVALID.into()),
            };
            let start = total;
            total = total
                .checked_add(sectors)
                .filter(|n| *n <= 540000)
                .ok_or("Image CD trop longue.")?;
            files.push(Binary {
                extension,
                length: meta.len(),
                path: resolved,
                created: meta.created().ok(),
                identity: identity(&meta),
                file: Mutex::new(file),
                start,
                sectors,
                modified: meta.modified().ok(),
            });
        }
        let mut tracks = Vec::new();
        let mut names = BTreeMap::new();
        for (i, entry) in sheet.tracks.iter().enumerate() {
            let file = &files[entry.file];
            let index = entry.index.ok_or("Position CUE invalide.")?;
            let end = sheet
                .tracks
                .get(i + 1)
                .filter(|next| next.file == entry.file)
                .and_then(|next| next.index)
                .unwrap_or(file.sectors);
            if index >= end
                || end > file.sectors
                || entry
                    .indexes
                    .values()
                    .any(|p| *p < index && entry.indexes.get(&0) != Some(p) || *p >= end)
            {
                return Err(
                    "Les positions CUE dépassent les données audio ou se chevauchent.".into(),
                );
            }
            if i > 0 && entry.file != sheet.tracks[i - 1].file && index != 0 {
                return Err("Un nouveau fichier audio doit commencer à 00:00:00.".into());
            }
            tracks.push(Track {
                number: entry.number,
                frames: u64::from(end - index) * FRAMES_PER_SECTOR,
                start: file.start + index,
            });
            names.insert(
                entry.number,
                (
                    entry.title.clone(),
                    entry.performer.clone().or_else(|| sheet.performer.clone()),
                ),
            );
        }
        Ok(Disc {
            token,
            tracks,
            path: canonical.to_string_lossy().into_owned(),
            layout: Vec::new(),
            leadout: total,
            gate: Arc::default(),
            image: Some(Arc::new(Self {
                path: canonical.clone(),
                files,
                title: sheet.title,
                performer: sheet.performer,
                names,
            })),
        })
    }
}
#[path = "image_reader.rs"]
mod reader;
impl Image {
    pub(super) fn reader(&self) -> reader::ImageReader<'_> {
        reader::ImageReader::new(self)
    }
}
#[cfg(test)]
#[path = "image_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "format_tests.rs"]
mod format_tests;
