//! Per-playback decoder state is released on Stop, seek retirement or source replacement.
use super::Image;
use crate::{ape, decoded};
use cd_da_reader::{AudioSectorReader, CdReaderError};
use std::{
    io::{Read, Seek, SeekFrom},
    sync::Mutex,
};
enum Decoder {
    Native(decoded::Decoded),
    Ape(ape::Ape),
}
pub(crate) struct ImageReader<'a> {
    image: &'a Image,
    decoder: Mutex<Option<(usize, Decoder)>>,
}
impl<'a> ImageReader<'a> {
    pub(super) fn new(image: &'a Image) -> Self {
        Self {
            image,
            decoder: Mutex::new(None),
        }
    }
}
impl AudioSectorReader for ImageReader<'_> {
    type Error = CdReaderError;
    fn read_audio_sectors(&self, start: u32, count: u32) -> Result<Vec<u8>, Self::Error> {
        let (index, binary) = self
            .image
            .files
            .iter()
            .enumerate()
            .find(|(_, f)| start >= f.start && start < f.start + f.sectors)
            .filter(|(_, f)| count <= 27 && count > 0 && start + count <= f.start + f.sectors)
            .ok_or_else(|| CdReaderError::Parse("Image sector bounds".into()))?;
        let mut file = binary
            .file
            .lock()
            .map_err(|_| CdReaderError::Parse("Image unavailable".into()))?;
        let meta = file.metadata().map_err(CdReaderError::Io)?;
        if meta.len() != binary.length || meta.modified().ok() != binary.modified {
            return Err(CdReaderError::Parse("Image changed".into()));
        }
        if binary.extension != "bin" {
            let frame = u64::from(start - binary.start) * 588;
            let mut decoder = self
                .decoder
                .lock()
                .map_err(|_| CdReaderError::Parse("Image unavailable".into()))?;
            let replace = decoder.as_ref().is_none_or(|(i, d)| {
                *i != index || matches!(d, Decoder::Ape(a) if a.position != frame)
            });
            if replace {
                // Drop an obsolete process before admitting another bounded reader.
                *decoder = None;
                let opened = if binary.extension == "ape" {
                    Decoder::Ape(ape::Ape::open(&file, frame).map_err(CdReaderError::Parse)?)
                } else {
                    Decoder::Native(
                        decoded::Decoded::open(
                            file.try_clone().map_err(CdReaderError::Io)?,
                            &binary.extension,
                        )
                        .map_err(CdReaderError::Parse)?,
                    )
                };
                *decoder = Some((index, opened));
            }
            return match decoder.as_mut().map(|(_, d)| d) {
                Some(Decoder::Native(d)) => d.read(frame, count as usize * 588),
                Some(Decoder::Ape(d)) => d.read(count as usize * 588),
                None => Err(decoded::FAILED.into()),
            }
            .map_err(CdReaderError::Parse);
        }
        file.seek(SeekFrom::Start(u64::from(start - binary.start) * 2352))
            .map_err(CdReaderError::Io)?;
        let mut bytes = vec![0; count as usize * 2352];
        file.read_exact(&mut bytes).map_err(CdReaderError::Io)?;
        Ok(bytes)
    }
}
