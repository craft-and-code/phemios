//! Progressive CD-quality FLAC/WAV decoding. No resampling, tag writes or whole-track buffers.
use std::{
    fs::File,
    io::{Seek, SeekFrom},
    panic::{AssertUnwindSafe, catch_unwind},
};
use symphonia::core::{
    audio::SampleBuffer,
    codecs::{CODEC_TYPE_FLAC, CODEC_TYPE_PCM_S16LE, Decoder, DecoderOptions},
    formats::{FormatOptions, FormatReader, SeekMode, SeekTo},
    io::MediaSourceStream,
    meta::{Limit, MetadataOptions},
    probe::Hint,
};
pub(super) const INVALID: &str = "Image audio invalide : CD stéréo 16 bits à 44,1 kHz requis.";
pub(super) const FAILED: &str = "Décodage de l’image audio impossible ou données incomplètes.";
pub(super) struct Decoded {
    format: Box<dyn FormatReader>,
    decoder: Box<dyn Decoder>,
    track: u32,
    pub frames: u64,
    position: u64,
    pending: Vec<i16>,
    offset: usize,
}
pub(super) fn sectors(frames: u64) -> Result<u32, String> {
    if frames == 0 || !frames.is_multiple_of(588) || frames / 588 > 540_000 {
        return Err(INVALID.into());
    }
    Ok((frames / 588) as u32)
}
impl Decoded {
    pub fn open(mut file: File, extension: &str) -> Result<Self, String> {
        catch_unwind(AssertUnwindSafe(|| {
            file.seek(SeekFrom::Start(0)).map_err(|_| FAILED)?;
            let mut hint = Hint::new();
            hint.with_extension(extension);
            let probed = symphonia::default::get_probe()
                .format(
                    &hint,
                    MediaSourceStream::new(Box::new(file), Default::default()),
                    &FormatOptions::default(),
                    &MetadataOptions {
                        limit_metadata_bytes: Limit::Maximum(65536),
                        limit_visual_bytes: Limit::Maximum(0),
                    },
                )
                .map_err(|_| INVALID)?;
            let track = probed.format.default_track().ok_or(INVALID)?;
            let p = &track.codec_params;
            if probed.format.tracks().len() != 1
                || p.sample_rate != Some(44100)
                || p.channels.is_none_or(|c| c.count() != 2)
                || p.bits_per_sample != Some(16)
                || ![CODEC_TYPE_FLAC, CODEC_TYPE_PCM_S16LE].contains(&p.codec)
                || p.max_frames_per_packet.is_some_and(|n| n > 65536)
                || p.time_base.is_none_or(|b| b.numer != 1 || b.denom != 44100)
            {
                return Err(INVALID.into());
            }
            let frames = p.n_frames.ok_or(INVALID)?;
            sectors(frames)?;
            let decoder = symphonia::default::get_codecs()
                .make(p, &DecoderOptions::default())
                .map_err(|_| INVALID)?;
            let track = track.id;
            Ok(Self {
                format: probed.format,
                decoder,
                track,
                frames,
                position: 0,
                pending: Vec::new(),
                offset: 0,
            })
        }))
        .unwrap_or_else(|_| Err(INVALID.into()))
    }
    pub fn read(&mut self, frame: u64, count: usize) -> Result<Vec<u8>, String> {
        catch_unwind(AssertUnwindSafe(|| self.read_inner(frame, count)))
            .unwrap_or_else(|_| Err(FAILED.into()))
    }
    fn read_inner(&mut self, frame: u64, count: usize) -> Result<Vec<u8>, String> {
        if count > 27 * 588
            || frame
                .checked_add(count as u64)
                .is_none_or(|n| n > self.frames)
        {
            return Err(FAILED.into());
        }
        if frame != self.position {
            let seeked = self
                .format
                .seek(
                    SeekMode::Accurate,
                    SeekTo::TimeStamp {
                        ts: frame,
                        track_id: self.track,
                    },
                )
                .map_err(|_| FAILED)?;
            if seeked.track_id != self.track || seeked.actual_ts > frame {
                return Err(FAILED.into());
            }
            self.decoder.reset();
            self.pending.clear();
            self.offset = 0;
            self.position = frame;
        }
        let mut bytes = Vec::with_capacity(count * 4);
        while bytes.len() < count * 4 {
            if self.offset == self.pending.len() {
                let packet = self.format.next_packet().map_err(|_| FAILED)?;
                if packet.track_id() != self.track || packet.dur() > 65536 {
                    return Err(FAILED.into());
                }
                let decoded = self.decoder.decode(&packet).map_err(|_| FAILED)?;
                if decoded.spec().rate != 44100
                    || decoded.spec().channels.count() != 2
                    || decoded.capacity() > 65536
                    || decoded.frames() == 0
                {
                    return Err(FAILED.into());
                }
                let end = packet
                    .ts()
                    .checked_add(decoded.frames() as u64)
                    .ok_or(FAILED)?;
                if packet.ts() > self.position {
                    return Err(FAILED.into());
                }
                if end <= self.position {
                    continue;
                }
                let mut buffer =
                    SampleBuffer::<i16>::new(decoded.capacity() as u64, *decoded.spec());
                buffer.copy_interleaved_ref(decoded);
                self.pending.clear();
                self.pending.extend_from_slice(buffer.samples());
                self.offset = (self.position - packet.ts()) as usize * 2;
            }
            let samples = (self.pending.len() - self.offset).min((count * 4 - bytes.len()) / 2);
            for sample in &self.pending[self.offset..self.offset + samples] {
                bytes.extend_from_slice(&sample.to_le_bytes());
            }
            self.offset += samples;
            self.position += (samples / 2) as u64;
        }
        Ok(bytes)
    }
}
