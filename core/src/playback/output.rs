use aede_audio::ring::{Consumer, Producer, RingBuffer};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, FromSample, SampleFormat, SizedSample, StreamConfig, SupportedStreamConfig};
use serde_json::{Value, json};
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering},
};
pub(super) struct Signals {
    pub volume: AtomicU32,
    pub paused: AtomicBool,
    pub finished: AtomicBool,
    // Intended output frames held by starvation/recovery; exclude startup, seek, pause and EOF.
    pub underrun_frames: AtomicU64,
    pub level: AtomicU32,
    pub levels: [AtomicU32; 4],
    pub spectrum: [AtomicU32; 24],
}
impl Default for Signals {
    fn default() -> Self {
        Self {
            volume: AtomicU32::new(0.5_f32.to_bits()),
            paused: AtomicBool::new(true),
            finished: AtomicBool::new(false),
            underrun_frames: AtomicU64::new(0),
            level: AtomicU32::new(0_f32.to_bits()),
            levels: std::array::from_fn(|_| AtomicU32::new(0_f32.to_bits())),
            spectrum: std::array::from_fn(|_| AtomicU32::new(0_f32.to_bits())),
        }
    }
}
pub(super) struct Output {
    pub rate: u32,
    pub producer: Producer<[f32; 2]>,
    pub consumed: Arc<AtomicU64>,
    pub failed: Arc<AtomicBool>,
    reset: Arc<super::transport::Reset>,
    _stream: cpal::Stream,
}
fn record_error(failed: &AtomicBool, kind: cpal::ErrorKind) {
    // CPAL has already rerouted this live stream; continue supplying its PCM.
    // https://github.com/RustAudio/cpal/blob/v0.18.1/src/error.rs#L15-L17
    if kind != cpal::ErrorKind::DeviceChanged {
        failed.store(true, Ordering::Relaxed);
    }
}
fn select(
    id: &str,
    requested_rate: Option<u32>,
) -> Result<(Device, SupportedStreamConfig), String> {
    let host = cpal::default_host();
    let device = if id.is_empty() {
        host.default_output_device()
    } else {
        host.output_devices()
            .map_err(|_| "Sorties audio indisponibles.")?
            .find(|device| device.id().is_ok_and(|value| value.to_string() == id))
    }
    .ok_or("Sortie audio indisponible ou déconnectée.")?;
    let default = device
        .default_output_config()
        .map_err(|_| "Format de sortie audio indisponible.")?;
    let config = if let Some(rate) = requested_rate {
        if default.sample_rate() == rate && (1..=2).contains(&default.channels()) {
            default
        } else {
            device
                .supported_output_configs()
                .map_err(|_| "Formats de sortie audio indisponibles.")?
                .filter(|config| (1..=2).contains(&config.channels()))
                .filter_map(|config| config.try_with_sample_rate(rate))
                .max_by_key(|config| {
                    (
                        config.channels() == 2,
                        config.sample_format() == default.sample_format(),
                    )
                })
                .ok_or("Cette sortie ne permet pas la lecture CD à 44,1 kHz.")?
        }
    } else {
        default
    };
    if !(1..=2).contains(&config.channels()) || !(8000..=192000).contains(&config.sample_rate()) {
        return Err("Cette sortie nécessite un format audio non pris en charge.".into());
    }
    Ok((device, config))
}
pub(super) fn devices() -> Result<Value, String> {
    let host = cpal::default_host();
    let default = host
        .default_output_device()
        .and_then(|d| d.id().ok())
        .map(|id| id.to_string());
    let mut rows = Vec::new();
    for device in host
        .output_devices()
        .map_err(|_| "Sorties audio indisponibles.")?
    {
        if rows.len() >= 64 {
            return Err("Trop de sorties audio annoncées.".into());
        }
        let id = device
            .id()
            .map_err(|_| "Identité de sortie audio indisponible.")?
            .to_string();
        rows.push(json!({"id":id,"name":device.description().map_err(|_|"Description audio indisponible.")?.name(),"default":default.as_ref()==Some(&id)}));
    }
    Ok(Value::Array(rows))
}
fn render<T: SizedSample + FromSample<f32>>(
    output: &mut [T],
    channels: usize,
    ring: &mut Consumer<[f32; 2]>,
    signals: &Signals,
    consumed: &AtomicU64,
    spectrum: &mut super::spectrum::Spectrum,
    transport: &mut super::transport::Transport,
) {
    let gain = f32::from_bits(signals.volume.load(Ordering::Relaxed));
    let mut frames = 0;
    let mut missing = 0;
    let finished = signals.finished.load(Ordering::Acquire);
    let ready = transport.ready(ring.slots(), finished);
    let rebuffering = transport.rebuffering();
    let mut squares = [0_f64; 2];
    let mut peaks = [0_f32; 2];
    let mut output_squares = 0_f64;
    for target in output.chunks_exact_mut(channels) {
        let paused = signals.paused.load(Ordering::Relaxed);
        let input = if paused || !ready {
            if !paused && !finished && rebuffering && !signals.finished.load(Ordering::Acquire) {
                missing += 1;
            }
            None
        } else {
            match ring.pop() {
                Ok(frame) => {
                    frames += 1;
                    spectrum.push(frame);
                    Some(frame)
                }
                Err(_) => {
                    if !finished && !signals.finished.load(Ordering::Acquire) {
                        transport.starved();
                        missing += 1;
                    }
                    None
                }
            }
        };
        let sample = input.unwrap_or([0.; 2]);
        let audible = transport.sample(input, paused);
        // Measure only PCM actually taken from the ring, before the local volume gain.
        // Stereo RMS/peak pairs do not pretend to be frequency-spectrum bands.
        for channel in 0..2 {
            let magnitude = sample[channel].abs().min(1.);
            squares[channel] += f64::from(magnitude).powi(2);
            peaks[channel] = peaks[channel].max(magnitude);
        }
        if channels == 1 {
            let value = (audible[0] + audible[1]) * 0.5 * gain;
            output_squares += f64::from(value).powi(2);
            target[0] = T::from_sample(value);
        } else {
            output_squares +=
                f64::from(audible[0] * gain).powi(2) + f64::from(audible[1] * gain).powi(2);
            target[0] = T::from_sample(audible[0] * gain);
            target[1] = T::from_sample(audible[1] * gain);
        }
    }
    // Publish this block before acknowledging a reset: no old-epoch frame may
    // be added after the worker sees the reset's release acknowledgement.
    consumed.fetch_add(frames, Ordering::Relaxed);
    signals
        .underrun_frames
        .fetch_add(missing, Ordering::Relaxed);
    if transport.flush(ring, consumed) {
        let _ = spectrum.finish();
        let _ = spectrum.finish();
    }
    for (target, value) in signals.spectrum.iter().zip(spectrum.finish()) {
        target.store(value.to_bits(), Ordering::Relaxed);
    }
    let count = (output.len() / channels) as f64;
    let rms = |channel: usize| {
        if count == 0. {
            0.
        } else {
            (squares[channel] / count).sqrt() as f32
        }
    };
    for (target, value) in signals
        .levels
        .iter()
        .zip([rms(0), peaks[0], rms(1), peaks[1]])
    {
        target.store(value.to_bits(), Ordering::Relaxed);
    }
    let count = (output.len() / channels * channels) as f64;
    let rms = if count == 0. {
        0.
    } else {
        (output_squares / count).sqrt() as f32
    };
    signals
        .level
        .store((rms * 4.).min(1.).to_bits(), Ordering::Relaxed);
}
impl Output {
    /// Request a callback-owned flush after a 5 ms stop ramp; return only previously consumed PCM.
    pub fn reset(&self) -> Result<u64, String> {
        let ticket = self.reset.requested.fetch_add(1, Ordering::Release) + 1;
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(1);
        while self.reset.applied.load(Ordering::Acquire) != ticket {
            if self.failed.load(Ordering::Relaxed) || std::time::Instant::now() >= deadline {
                return Err("La sortie audio ne confirme pas le déplacement.".into());
            }
            std::thread::sleep(std::time::Duration::from_millis(1));
        }
        Ok(self.reset.consumed.load(Ordering::Relaxed))
    }
    pub fn freeze(&self) -> Result<(), String> {
        self._stream
            .pause()
            .map_err(|_| "Impossible de suspendre la sortie audio.".into())
    }
    pub fn open(id: &str, signals: Arc<Signals>) -> Result<Self, String> {
        Self::open_rate(id, signals, None)
    }
    pub fn open_cd(id: &str, signals: Arc<Signals>) -> Result<Self, String> {
        Self::open_rate(id, signals, Some(phemios_cd::SAMPLE_RATE))
    }
    fn open_rate(id: &str, signals: Arc<Signals>, rate: Option<u32>) -> Result<Self, String> {
        signals.finished.store(false, Ordering::Release);
        signals.underrun_frames.store(0, Ordering::Relaxed);
        signals.level.store(0_f32.to_bits(), Ordering::Relaxed);
        for level in &signals.levels {
            level.store(0_f32.to_bits(), Ordering::Relaxed);
        }
        for level in &signals.spectrum {
            level.store(0_f32.to_bits(), Ordering::Relaxed);
        }
        let (device, supported) = select(id, rate)?;
        let rate = supported.sample_rate();
        let format = supported.sample_format();
        let config: StreamConfig = supported.into();
        let channels = usize::from(config.channels);
        let (producer, mut ring) = RingBuffer::new((rate / 2) as usize);
        let consumed = Arc::new(AtomicU64::new(0));
        let failed = Arc::new(AtomicBool::new(false));
        let mut spectrum = super::spectrum::Spectrum::new(rate);
        let reset = Arc::new(super::transport::Reset::default());
        let mut transport = super::transport::Transport::new(rate, reset.clone());
        let count = consumed.clone();
        let failure = failed.clone();
        macro_rules! build {
            ($sample:ty) => {
                device.build_output_stream(
                    config,
                    move |data: &mut [$sample], _| {
                        render(
                            data,
                            channels,
                            &mut ring,
                            &signals,
                            &count,
                            &mut spectrum,
                            &mut transport,
                        )
                    },
                    move |error| record_error(&failure, error.kind()),
                    None,
                )
            };
        }
        let stream = match format {
            SampleFormat::F32 => build!(f32),
            SampleFormat::F64 => build!(f64),
            SampleFormat::I8 => build!(i8),
            SampleFormat::I16 => build!(i16),
            SampleFormat::I24 => build!(cpal::I24),
            SampleFormat::I32 => build!(i32),
            SampleFormat::I64 => build!(i64),
            SampleFormat::U8 => build!(u8),
            SampleFormat::U16 => build!(u16),
            SampleFormat::U32 => build!(u32),
            SampleFormat::U64 => build!(u64),
            _ => return Err("Format de sortie audio non pris en charge.".into()),
        }
        .map_err(|_| "Impossible d’ouvrir la sortie audio.")?;
        stream
            .play()
            .map_err(|_| "Impossible de démarrer la sortie audio.")?;
        Ok(Self {
            rate,
            producer,
            consumed,
            failed,
            reset,
            _stream: stream,
        })
    }
}
#[cfg(test)]
#[path = "output_tests.rs"]
mod tests;
