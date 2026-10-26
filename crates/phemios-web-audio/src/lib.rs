//! Bounded Web Audio adapter over the same published Aède DSP used by the native applications.
#![warn(missing_docs)]
use aede_audio::dsp::{Dsp, PcmFormat};
use wasm_bindgen::prelude::*;
const SAMPLES: usize = 8192;
/// One stereo AudioWorklet instance; no catalogue, credentials, filesystem or native output.
pub struct WebDsp {
    dsp: Dsp,
    samples: Vec<f32>,
    muted: bool,
}
impl WebDsp {
    /// Allocate and validate outside the rendering callback. Unsupported formats return undefined.
    pub fn create(sample_rate: u32) -> Option<WebDsp> {
        if !(8000..=192000).contains(&sample_rate) {
            return None;
        }
        let format = PcmFormat::new(sample_rate, 2).ok()?;
        Some(Self {
            dsp: Dsp::new(format),
            samples: vec![0.0; SAMPLES],
            muted: false,
        })
    }
    /// Stable WASM-memory offset; the caller writes complete interleaved stereo frames here.
    pub fn buffer_ptr(&mut self) -> usize {
        self.samples.as_mut_ptr() as usize
    }
    /// Fixed sample capacity, allocated only once.
    pub fn buffer_len(&self) -> usize {
        self.samples.len()
    }
    /// App volume uses the existing Aède gain ramp; exact mute publishes zeros.
    pub fn set_volume(&mut self, volume: f32) -> bool {
        if !volume.is_finite() || !(0.0..=1.0).contains(&volume) {
            return false;
        }
        self.muted = volume == 0.0;
        volume == 0.0 || self.dsp.set_gain_db(20.0 * volume.log10(), 256).is_ok()
    }
    /// Process at most 4096 stereo frames in place; invalid PCM clears the bounded block.
    /// Oversized requests are refused, and the worklet must silence its output on any refusal.
    pub fn process(&mut self, frames: usize) -> bool {
        let Some(samples) = frames
            .checked_mul(2)
            .and_then(|n| self.samples.get_mut(..n))
        else {
            return false;
        };
        if self.muted {
            samples.fill(0.0);
            return true;
        }
        if self.dsp.process_for_output(samples).is_err() {
            samples.fill(0.0);
            return false;
        }
        true
    }
}
// Each AudioWorklet owns one WASM instance. Safe thread-local ownership avoids JS class
// borrowing exceptions/TextDecoder imports, which AudioWorklet globals need not provide.
thread_local! { static PROCESSOR: std::cell::RefCell<Option<WebDsp>> = const { std::cell::RefCell::new(None) }; }
/// Initialize exactly once, before the worklet starts rendering.
#[wasm_bindgen]
pub fn initialize(sample_rate: u32) -> bool {
    PROCESSOR.with(|cell| {
        let Ok(mut state) = cell.try_borrow_mut() else {
            return false;
        };
        if state.is_some() {
            return false;
        }
        *state = WebDsp::create(sample_rate);
        state.is_some()
    })
}
/// Stable shared block offset in this instance's linear memory.
#[wasm_bindgen]
pub fn buffer_ptr() -> usize {
    PROCESSOR.with(|cell| {
        cell.try_borrow_mut()
            .ok()
            .and_then(|mut p| p.as_mut().map(WebDsp::buffer_ptr))
            .unwrap_or(0)
    })
}
/// Fixed interleaved sample capacity.
#[wasm_bindgen]
pub fn buffer_len() -> usize {
    SAMPLES
}
/// Validate and apply an app volume request outside rendering.
#[wasm_bindgen]
pub fn set_volume(volume: f32) -> bool {
    PROCESSOR.with(|cell| {
        cell.try_borrow_mut()
            .ok()
            .and_then(|mut p| p.as_mut().map(|p| p.set_volume(volume)))
            .unwrap_or(false)
    })
}
/// Apply the shared DSP to a bounded block; invalid data produces silence.
#[wasm_bindgen]
pub fn process_audio(frames: usize) -> bool {
    PROCESSOR.with(|cell| {
        cell.try_borrow_mut()
            .ok()
            .and_then(|mut p| p.as_mut().map(|p| p.process(frames)))
            .unwrap_or(false)
    })
}
#[cfg(test)]
#[path = "lib_tests.rs"]
mod tests;
