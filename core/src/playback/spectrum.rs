//! A fixed stereo filter bank observes consumed PCM without allocating or changing audio.
//! RBJ constant-peak bandpass coefficients: <https://www.w3.org/TR/audio-eq-cookbook/>.
use std::f64::consts::PI;
pub(super) fn frequencies() -> [f32; 24] {
    std::array::from_fn(|i| (31.5_f64 * (16000_f64 / 31.5).powf(i as f64 / 23.)) as f32)
}
#[derive(Clone, Copy, Default)]
struct Band {
    b: f64,
    a1: f64,
    a2: f64,
    state: [[f64; 2]; 2],
}
pub(super) struct Spectrum {
    bands: [Band; 24],
    squares: [f64; 24],
    frames: u64,
}
impl Spectrum {
    pub fn new(rate: u32) -> Self {
        let hz = frequencies();
        Self {
            bands: std::array::from_fn(|i| {
                if f64::from(hz[i]) >= f64::from(rate) * 0.45 {
                    return Band::default();
                }
                let w = 2. * PI * f64::from(hz[i]) / f64::from(rate);
                let alpha = w.sin() / (2. * 4.);
                Band {
                    b: alpha / (1. + alpha),
                    a1: -2. * w.cos() / (1. + alpha),
                    a2: (1. - alpha) / (1. + alpha),
                    state: [[0.; 2]; 2],
                }
            }),
            squares: [0.; 24],
            frames: 0,
        }
    }
    pub fn push(&mut self, samples: [f32; 2]) {
        self.frames += 1;
        for (band, power) in self.bands.iter_mut().zip(&mut self.squares) {
            for (channel, sample) in samples.iter().enumerate() {
                let x = f64::from(*sample);
                let y = band.b * x + band.state[channel][0];
                band.state[channel][0] = -band.a1 * y + band.state[channel][1];
                band.state[channel][1] = -band.b * x - band.a2 * y;
                *power += y * y * 0.5;
            }
        }
    }
    pub fn finish(&mut self) -> [f32; 24] {
        let result = std::array::from_fn(|i| {
            if self.frames == 0 {
                0.
            } else {
                ((self.squares[i] / self.frames as f64).sqrt() * 2.).clamp(0., 1.) as f32
            }
        });
        if self.frames == 0 {
            for band in &mut self.bands {
                band.state = [[0.; 2]; 2];
            }
        }
        self.squares = [0.; 24];
        self.frames = 0;
        result
    }
}
#[cfg(test)]
#[path = "spectrum_tests.rs"]
mod tests;
