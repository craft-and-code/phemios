//! Read-only physical CD and CUE audio-image sources, isolated from Tauri, accounts, network and audio output.
#![warn(missing_docs)]
mod access;
mod ape;
mod cdtext;
#[cfg(test)]
mod cdtext_fixtures;
#[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows", test))]
mod cdtext_io;
#[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows", test))]
mod cdtext_packs;
mod cue;
mod decoded;
mod discovery;
mod eject;
mod image;
#[cfg(any(target_os = "linux", test))]
mod linux_cdtext;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
mod macos_cdtext;
#[cfg(target_os = "macos")]
mod macos_cf;
mod physical;
mod process;
mod stream;
#[cfg(any(target_os = "windows", test))]
mod windows_cdtext;
use cd_da_reader::{AudioSectorReader, CdReader, Toc};
pub use discovery::{Drive, Library};
use std::sync::{Arc, Mutex};
pub use stream::{Chunk, TrackReader};

/// CD-DA stereo sample frames per second.
pub const SAMPLE_RATE: u32 = 44_100;
/// Stereo frames carried by one audio sector.
pub const FRAMES_PER_SECTOR: u64 = 588;
/// One audio track; disc numbers need not start at one or be contiguous.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Track {
    /// Physical number from the disc's table of contents.
    pub number: u8,
    /// Exact stereo sample frame count, excluding a CD-Extra data-session gap.
    pub frames: u64,
    start: u32,
}
impl Track {
    /// Whole milliseconds; source frame positions retain the sub-millisecond remainder.
    pub fn duration_ms(&self) -> u64 {
        self.frames * 1000 / u64::from(SAMPLE_RATE)
    }
}
/// Session-only selection. Its token is not a catalogue identity or metadata assertion.
#[derive(Clone)]
pub struct Disc {
    /// Opaque in-process identity, never a device path.
    pub token: String,
    /// Audio tracks only; data tracks never enter the playback queue.
    pub tracks: Vec<Track>,
    pub(crate) path: String,
    layout: Vec<(u8, u32, bool)>,
    leadout: u32,
    gate: Arc<Mutex<()>>,
    image: Option<Arc<image::Image>>,
    text: cdtext::Text,
}
impl Disc {
    fn inspect(
        reader: &impl AudioSectorReader,
        toc: &Toc,
        path: String,
        token: String,
        gate: Arc<Mutex<()>>,
    ) -> Result<Self, String> {
        if toc.tracks.is_empty()
            || toc.tracks.len() > 99
            || toc.leadout_lba > 540_000
            || toc.first_track == 0
            || toc.last_track > 99
            || toc.first_track > toc.last_track
            || toc
                .tracks
                .first()
                .is_none_or(|t| t.number != toc.first_track)
            || toc.tracks.last().is_none_or(|t| t.number != toc.last_track)
            || toc.tracks.iter().any(|t| t.start_lba >= toc.leadout_lba)
            || toc
                .tracks
                .windows(2)
                .any(|w| w[0].number >= w[1].number || w[0].start_lba >= w[1].start_lba)
        {
            return Err("Table des pistes du CD invalide.".into());
        }
        let mut tracks = Vec::new();
        for track in toc.tracks.iter().filter(|t| t.is_audio) {
            // The upstream sector-source API derives CD-Extra bounds without reading audio.
            let stream = cd_da_reader::open_track_stream(reader, toc, track.number)
                .map_err(|_| "Limites des pistes du CD invalides.")?;
            let frames = u64::from(stream.total_sectors()) * FRAMES_PER_SECTOR;
            if frames == 0 {
                return Err("Une piste du CD est vide.".into());
            }
            tracks.push(Track {
                number: track.number,
                frames,
                start: track.start_lba,
            });
        }
        if tracks.is_empty() {
            return Err("Aucun CD audio dans ce lecteur.".into());
        }
        Ok(Self {
            token,
            tracks,
            path,
            layout: toc
                .tracks
                .iter()
                .map(|t| (t.number, t.start_lba, t.is_audio))
                .collect(),
            leadout: toc.leadout_lba,
            gate,
            image: None,
            text: cdtext::Text::default(),
        })
    }
    fn matches(&self, toc: &Toc) -> bool {
        self.leadout == toc.leadout_lba
            && self.layout.iter().copied().eq(toc
                .tracks
                .iter()
                .map(|t| (t.number, t.start_lba, t.is_audio)))
    }
    pub(crate) fn same_image(&self, other: &Self) -> bool {
        self.tracks == other.tracks
            && self
                .image
                .as_ref()
                .zip(other.image.as_ref())
                .is_some_and(|(a, b)| a.same(b))
    }
    /// On-disc CD-Text or explicit CUE title; no network identification.
    pub fn title(&self) -> Option<&str> {
        self.image
            .as_ref()
            .and_then(|image| image.title.as_deref())
            .or(self.text.title.as_deref())
    }
    /// On-disc or CUE performer, never a resolved catalogue/account identity.
    pub fn performer(&self) -> Option<&str> {
        self.image
            .as_ref()
            .and_then(|image| image.performer.as_deref())
            .or(self.text.performer.as_deref())
    }
    /// CD-Text or CUE track names, keyed by physical track number.
    pub fn track_names(&self, number: u8) -> (Option<&str>, Option<&str>) {
        self.image
            .as_ref()
            .and_then(|image| image.names.get(&number))
            .or_else(|| self.text.names.get(&number))
            .map(|(title, performer)| (title.as_deref(), performer.as_deref().or(self.performer())))
            .unwrap_or_default()
    }
    /// Stable physical position within this process-only disc selection.
    pub fn reference(&self, number: u8) -> String {
        format!("track:cd/{}/{number}", self.token)
    }
    /// Resolve only this selection's audio tracks, never a file or another device.
    pub fn track(&self, reference: &str) -> Result<&Track, String> {
        self.tracks
            .iter()
            .find(|t| self.reference(t.number) == reference)
            .ok_or_else(|| "La sélection du CD a changé.".into())
    }
    /// Hold one source operation at a time; recheck an optical TOC or read retained image handles.
    /// The callback runs on the caller's I/O worker, never on the audio callback.
    pub fn with_stream<T>(
        &self,
        number: u8,
        current: impl Fn() -> bool,
        work: impl FnOnce(&mut TrackReader<'_>) -> Result<T, String>,
    ) -> Result<T, String> {
        let _guard = access::lock(&self.gate, current)?;
        let track = self
            .tracks
            .iter()
            .find(|t| t.number == number)
            .ok_or("Piste absente du CD.")?;
        if let Some(image) = &self.image {
            let reader = image.reader();
            return work(&mut TrackReader::new(&reader, track));
        }
        let reader = CdReader::open_path(&self.path)
            .map_err(|_| "Le lecteur CD est absent, occupé ou inaccessible.")?;
        let toc = reader
            .read_toc()
            .map_err(|_| "Le CD a été retiré ou ne peut pas être lu.")?;
        if !self.matches(&toc) {
            return Err("Le CD a changé. Actualisez la liste des lecteurs.".into());
        }
        let track = self
            .tracks
            .iter()
            .find(|t| t.number == number)
            .ok_or("Piste absente du CD.")?;
        work(&mut TrackReader::new(&stream::NativeReader(&reader), track))
    }
}

#[cfg(test)]
#[path = "disc_tests.rs"]
mod tests;
