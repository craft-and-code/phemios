use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, FromSample, SampleFormat, SizedSample, StreamConfig, SupportedStreamConfig};
use rtrb::{Consumer, Producer, RingBuffer};
use serde_json::{Value, json};
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering},
};
pub(super) struct Signals {
    pub volume: AtomicU32,
    pub paused: AtomicBool,
    pub levels: [AtomicU32; 4],
}
impl Default for Signals {
    fn default() -> Self {
        Self {
            volume: AtomicU32::new(0.5_f32.to_bits()),
            paused: AtomicBool::new(true),
            levels: std::array::from_fn(|_| AtomicU32::new(0_f32.to_bits())),
        }
    }
}
pub(super) struct Output {
    pub rate: u32,
    pub producer: Producer<[f32; 2]>,
    pub consumed: Arc<AtomicU64>,
    pub failed: Arc<AtomicBool>,
    _stream: cpal::Stream,
}
fn select(id: &str) -> Result<(Device, SupportedStreamConfig), String> {
    let host = cpal::default_host();
    let device = if id.is_empty() {
        host.default_output_device()
    } else {
        host.output_devices()
            .map_err(|_| "Sorties audio indisponibles.")?
            .find(|device| device.id().is_ok_and(|value| value.to_string() == id))
    }
    .ok_or("Sortie audio indisponible ou déconnectée.")?;
    let config = device
        .default_output_config()
        .map_err(|_| "Format de sortie audio indisponible.")?;
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
) {
    let gain = f32::from_bits(signals.volume.load(Ordering::Relaxed));
    let mut frames = 0;
    let mut squares = [0_f64; 2];
    let mut peaks = [0_f32; 2];
    for target in output.chunks_exact_mut(channels) {
        let sample = if signals.paused.load(Ordering::Relaxed) {
            [0., 0.]
        } else {
            match ring.pop() {
                Ok(frame) => {
                    frames += 1;
                    frame
                }
                Err(_) => [0., 0.],
            }
        };
        // Measure only PCM actually taken from the ring, before the local volume gain.
        // Stereo RMS/peak pairs do not pretend to be frequency-spectrum bands.
        for channel in 0..2 {
            let magnitude = sample[channel].abs().min(1.);
            squares[channel] += f64::from(magnitude).powi(2);
            peaks[channel] = peaks[channel].max(magnitude);
        }
        if channels == 1 {
            target[0] = T::from_sample((sample[0] + sample[1]) * 0.5 * gain);
        } else {
            target[0] = T::from_sample(sample[0] * gain);
            target[1] = T::from_sample(sample[1] * gain);
        }
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
    consumed.fetch_add(frames, Ordering::Relaxed);
}
impl Output {
    pub fn freeze(&self) -> Result<(), String> {
        self._stream
            .pause()
            .map_err(|_| "Impossible de suspendre la sortie audio.".into())
    }
    pub fn open(id: &str, signals: Arc<Signals>) -> Result<Self, String> {
        for level in &signals.levels {
            level.store(0_f32.to_bits(), Ordering::Relaxed);
        }
        let (device, supported) = select(id)?;
        let rate = supported.sample_rate();
        let format = supported.sample_format();
        let config: StreamConfig = supported.into();
        let channels = usize::from(config.channels);
        let (producer, mut ring) = RingBuffer::new((rate / 2) as usize);
        let consumed = Arc::new(AtomicU64::new(0));
        let failed = Arc::new(AtomicBool::new(false));
        let count = consumed.clone();
        let failure = failed.clone();
        macro_rules! build {
            ($sample:ty) => {
                device.build_output_stream(
                    config,
                    move |data: &mut [$sample], _| {
                        render(data, channels, &mut ring, &signals, &count)
                    },
                    move |_| {
                        failure.store(true, Ordering::Relaxed);
                    },
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
            _stream: stream,
        })
    }
}
#[cfg(test)]
#[path = "output_tests.rs"]
mod tests;
