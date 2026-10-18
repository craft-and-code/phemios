use super::{FRAMES_PER_SECTOR, Track};
use cd_da_reader::{AudioSectorReader, CdReader, CdReaderError, ReadOptions, RetryConfig};
pub(crate) struct NativeReader<'a>(pub &'a CdReader);
impl AudioSectorReader for NativeReader<'_> {
    type Error = CdReaderError;
    fn read_audio_sectors(&self, start: u32, count: u32) -> Result<Vec<u8>, Self::Error> {
        self.0.read_sector_range(
            start,
            count,
            &ReadOptions::default().with_retry(RetryConfig::default().with_max_attempts(2)),
        )
    }
}
/// One bounded source chunk, with exact sub-sector seeking and no whole-track allocation.
pub struct Chunk {
    bytes: Vec<u8>,
    skip: usize,
}
impl Chunk {
    /// Convert signed little-endian stereo samples; normalized endpoints stay finite in [-1,1).
    pub fn frames(&self) -> impl ExactSizeIterator<Item = [f32; 2]> + '_ {
        self.bytes
            .as_chunks::<4>()
            .0
            .iter()
            .skip(self.skip)
            .map(|b| {
                [
                    f32::from(i16::from_le_bytes([b[0], b[1]])) / 32768.,
                    f32::from(i16::from_le_bytes([b[2], b[3]])) / 32768.,
                ]
            })
    }
}
/// Blocking sector reader used only by the dedicated CD I/O worker.
pub struct TrackReader<'a> {
    reader: &'a dyn AudioSectorReader<Error = CdReaderError>,
    track: &'a Track,
    frame: u64,
}
impl<'a> TrackReader<'a> {
    pub(crate) fn new(
        reader: &'a dyn AudioSectorReader<Error = CdReaderError>,
        track: &'a Track,
    ) -> Self {
        Self {
            reader,
            track,
            frame: 0,
        }
    }
    /// Move to an exact stereo frame, including EOF; out-of-range requests fail explicitly.
    pub fn seek(&mut self, frame: u64) -> Result<(), String> {
        if frame > self.track.frames {
            return Err("Position hors du CD.".into());
        }
        self.frame = frame;
        Ok(())
    }
    /// Read at most 27 sectors (~64 KiB); a short/corrupt read never produces partial audio.
    pub fn next_chunk(&mut self) -> Result<Option<Chunk>, String> {
        if self.frame == self.track.frames {
            return Ok(None);
        }
        let sector = self.frame / FRAMES_PER_SECTOR;
        let count = (self.track.frames / FRAMES_PER_SECTOR - sector).min(27) as u32;
        let bytes = self
            .reader
            .read_audio_sectors(self.track.start + sector as u32, count)
            .map_err(
                |_| "Lecture du CD impossible : disque retiré, illisible ou erreur du lecteur.",
            )?;
        if bytes.len() != count as usize * 2352 {
            return Err("Le lecteur CD a renvoyé des données incomplètes.".into());
        }
        let skip = (self.frame % FRAMES_PER_SECTOR) as usize;
        self.frame = (sector + u64::from(count)) * FRAMES_PER_SECTOR;
        Ok(Some(Chunk { bytes, skip }))
    }
}
#[cfg(test)]
#[path = "stream_tests.rs"]
mod tests;
