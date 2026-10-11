//! Synthetic release timing of the exact callback and unchanged filter bank.
//! Run `cargo run --release -p phemios-core --example audio_callback_profile`.
//! No device is opened. This harness is excluded from behavioral test builds.
#[cfg(not(test))]
#[path = "../src/playback/spectrum.rs"]
mod spectrum;
#[cfg(not(test))]
#[path = "../src/playback/transport.rs"]
mod transport;
#[cfg(not(test))]
#[allow(dead_code)] // Device discovery/opening is deliberately outside this timing harness.
mod output {
    include!("../src/playback/output.rs");
    pub(super) fn profile() {
        use std::hint::black_box;
        use std::time::{Duration, Instant};
        const BLOCK: usize = 256;
        const SECONDS: usize = 30;
        for rate in [48000_u32, 192000] {
            let blocks = rate as usize * SECONDS / BLOCK;
            let (mut producer, mut consumer) = RingBuffer::new((rate / 2) as usize);
            let signals = Signals::default();
            signals.paused.store(false, Ordering::Relaxed);
            let consumed = AtomicU64::new(0);
            let mut spectrum = super::spectrum::Spectrum::new(rate);
            let mut transport = super::transport::Transport::new(rate, Arc::default());
            let mut samples = [0_f32; BLOCK * 2];
            for _ in 0..rate / 10 {
                producer.push([0.123, -0.123]).unwrap();
            }
            let mut elapsed = Duration::ZERO;
            let mut maximum = Duration::ZERO;
            for _ in 0..blocks {
                for _ in 0..BLOCK {
                    producer.push(black_box([0.123, -0.123])).unwrap();
                }
                let start = Instant::now();
                render(
                    &mut samples,
                    2,
                    &mut consumer,
                    &signals,
                    &consumed,
                    &mut spectrum,
                    &mut transport,
                );
                let duration = start.elapsed();
                elapsed += duration;
                maximum = maximum.max(duration);
                black_box(&samples);
            }
            let callback = elapsed.as_secs_f64();
            let mut bank = super::spectrum::Spectrum::new(rate);
            let start = Instant::now();
            for _ in 0..blocks {
                for _ in 0..BLOCK {
                    bank.push(black_box([0.123, -0.123]));
                }
                black_box(bank.finish());
            }
            eprintln!(
                "rate={rate} block={BLOCK} audio_seconds={SECONDS} callback_ms={:.3} spectrum_only_ms={:.3} callback_time_percent={:.3} max_callback_us={:.3} deadline_us={:.3}",
                callback * 1000.,
                start.elapsed().as_secs_f64() * 1000.,
                callback / SECONDS as f64 * 100.,
                maximum.as_secs_f64() * 1e6,
                BLOCK as f64 / f64::from(rate) * 1e6
            );
            assert_eq!(consumed.load(Ordering::Relaxed), (blocks * BLOCK) as u64);
            assert_eq!(signals.underrun_frames.load(Ordering::Relaxed), 0);
        }
    }
}
#[cfg(not(test))]
fn main() {
    output::profile();
}
#[cfg(test)]
fn main() {}
