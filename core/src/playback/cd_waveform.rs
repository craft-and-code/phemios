//! Bounded progressive source envelope, filled only from chunks already read for CD playback.
use serde_json::{Value, json};
pub(super) struct Envelope {
    pub reference: String,
    duration_ms: u64,
    sample_rate: u32,
    pub bucket_frames: u64,
    pub peaks: Vec<Option<f32>>,
    frames: u64,
}
impl Envelope {
    pub fn new(reference: &str, frames: u64) -> Self {
        let bucket_frames = frames.div_ceil(1024).max(1);
        Self {
            reference: reference.into(),
            duration_ms: frames * 1000 / 44100,
            sample_rate: 44100,
            bucket_frames,
            peaks: vec![None; frames.div_ceil(bucket_frames) as usize],
            frames,
        }
    }
    pub fn snapshot(&self) -> Value {
        json!({"reference":self.reference,"duration_ms":self.duration_ms,"sample_rate":self.sample_rate,"bucket_frames":self.bucket_frames,"peaks":self.peaks})
    }
    pub fn record(&mut self, offset: u64, samples: impl Iterator<Item = [f32; 2]>) {
        for (index, sample) in samples.enumerate() {
            let Some(frame) = offset
                .checked_add(index as u64)
                .filter(|p| *p < self.frames)
            else {
                break;
            };
            let peak = sample[0].abs().max(sample[1].abs()).min(1.);
            let target = &mut self.peaks[(frame / self.bucket_frames) as usize];
            *target = Some(target.unwrap_or(0.).max(peak));
        }
    }
}
#[cfg(test)]
#[path = "cd_waveform_tests.rs"]
mod tests;
