use serde_json::{Value, json};
pub(super) fn start(reference: &str, rate: u32, policy: super::Policy) -> Result<String, String> {
    if !reference
        .strip_prefix("track:")
        .is_some_and(|key| !key.is_empty())
        || !(8000..=192000).contains(&rate)
    {
        return Err("Sélection audio invalide.".into());
    }
    let value=json!({"type":"start","track":reference,"interactive":true,"normalize":match policy { super::Policy::WithoutEffects => "off", super::Policy::Dsp => "album" },"sample_rate":rate,"bass":0,"treble":0}).to_string();
    if value.len() > 4096 {
        return Err("Référence audio trop longue pour Aède.".into());
    }
    Ok(value)
}
pub(super) fn pcm(bytes: &[u8], channels: usize) -> Result<Vec<[f32; 2]>, String> {
    if !(1..=2).contains(&channels)
        || bytes.is_empty()
        || bytes.len() > 32768
        || !bytes.len().is_multiple_of(4 * channels)
    {
        return Err("Trame PCM Aède invalide.".into());
    }
    let mut frames = Vec::with_capacity(bytes.len() / (4 * channels));
    for frame in bytes.chunks_exact(4 * channels) {
        let left = f32::from_le_bytes([frame[0], frame[1], frame[2], frame[3]]);
        let right = if channels == 2 {
            f32::from_le_bytes([frame[4], frame[5], frame[6], frame[7]])
        } else {
            left
        };
        if !left.is_finite()
            || !right.is_finite()
            || left.abs() > 1.000001
            || right.abs() > 1.000001
        {
            return Err("Échantillon PCM Aède invalide.".into());
        }
        frames.push([left.clamp(-1., 1.), right.clamp(-1., 1.)]);
    }
    Ok(frames)
}
pub(super) fn unsigned(value: &Value, key: &str) -> Result<u64, String> {
    value[key]
        .as_u64()
        .ok_or_else(|| "Réponse de lecture Aède invalide.".into())
}
#[cfg(test)]
#[path = "protocol_tests.rs"]
mod tests;
pub(super) struct Format {
    pub channels: usize,
    pub epoch: u64,
    pub position: u64,
    pub duration: Option<u64>,
}
pub(super) fn format(value: &Value, reference: &str, rate: u32) -> Result<Format, String> {
    let channels = unsigned(value, "channels")?;
    if value["encoding"] != "f32le"
        || value["track"] != reference
        || unsigned(value, "sample_rate")? != u64::from(rate)
        || !(1..=2).contains(&channels)
    {
        return Err("Format PCM Aède incompatible avec la sélection ou la sortie.".into());
    }
    let duration = if value["duration_ms"].is_null() {
        None
    } else {
        Some(unsigned(value, "duration_ms")?)
    };
    Ok(Format {
        channels: channels as usize,
        epoch: unsigned(value, "epoch")?,
        position: unsigned(value, "position_ms")?,
        duration,
    })
}
