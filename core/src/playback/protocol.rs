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
/// Remote timing must fit the frame conversion at the negotiated output rate.
/// Epochs and frame counters use `unsigned` instead; they are not milliseconds.
pub(super) fn milliseconds(value: &Value, key: &str, rate: u32) -> Result<u64, String> {
    let ms = unsigned(value, key)?;
    if rate == 0 || ms.checked_mul(u64::from(rate)).is_none() {
        return Err("Position ou durée audio Aède trop grande.".into());
    }
    Ok(ms)
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
        Some(milliseconds(value, "duration_ms", rate)?)
    };
    Ok(Format {
        channels: channels as usize,
        epoch: unsigned(value, "epoch")?,
        position: milliseconds(value, "position_ms", rate)?,
        duration,
    })
}

/// Preserve server confirmation semantics while making known storage failures actionable.
pub(super) fn failure(value: &Value) -> String {
    let message = value["message"].as_str().unwrap_or("erreur du serveur");
    let detail = match message {
        "history source changed or became unavailable; rescan the library" => {
            "Le fichier a changé ou est indisponible. Rescannez la bibliothèque."
        }
        "history storage remained busy; saving was not confirmed" => {
            "L’historique est occupé. L’écoute n’a pas été confirmée ; réessayez."
        }
        "private history storage could not be read; retain the file and check the server log" => {
            "L’historique est illisible. Aède conserve le fichier ; consultez ses journaux."
        }
        "private history storage could not be written; check disk space and permissions" => {
            "Impossible d’écrire l’historique. Vérifiez l’espace disque et les permissions."
        }
        "history saving timed out; its final status is uncertain" => {
            "La confirmation de l’historique a expiré. Vérifiez l’historique avant de relancer."
        }
        "the listening history could not be saved" => {
            "L’historique n’a pas pu être enregistré. Consultez les journaux Aède pour la cause."
        }
        _ => message,
    };
    format!("Lecture Aède refusée : {detail}")
}
