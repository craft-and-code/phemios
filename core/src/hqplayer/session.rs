//! Actual HQPlayer transport state and typed controls.
use super::protocol::Attributes;
use super::{OUTPUT, Session};
use serde_json::{Value, json};
/// Local validation never changes transport ownership; protocol uncertainty does.
pub(super) enum ControlError {
    Rejected(&'static str),
    Transport(String),
}
impl From<&'static str> for ControlError {
    fn from(message: &'static str) -> Self {
        Self::Rejected(message)
    }
}

pub(super) fn number(a: &Attributes, key: &str) -> Result<f64, String> {
    a.get(key)
        .and_then(|s| s.parse::<f64>().ok())
        .filter(|n| n.is_finite())
        .ok_or_else(|| "État HQPlayer invalide.".into())
}
fn millis(a: &Attributes, key: &str) -> Result<u64, String> {
    let n = number(a, key)?;
    if !(0. ..=604800.).contains(&n) {
        return Err("Durée HQPlayer invalide.".into());
    }
    Ok((n * 1000.).round() as u64)
}
impl Session {
    pub(super) fn read_state(&mut self) -> Result<Value, String> {
        let a = self
            .connection
            .call("Status", &[("subscribe", "0".into())], false)?;
        let status = match a
            .get("state")
            .and_then(|v| v.parse::<u32>().ok())
            .ok_or("État HQPlayer invalide.")?
        {
            0 => "ended",
            1 => "paused",
            2 => "playing",
            3 => "connecting",
            _ => return Err("État HQPlayer invalide.".into()),
        };
        let total = a
            .get("tracks_total")
            .and_then(|v| v.parse::<usize>().ok())
            .ok_or("État HQPlayer invalide.")?;
        if total != self.tracks.len() {
            return Err("La file HQPlayer a été modifiée par un autre contrôleur.".into());
        }
        // Match the URI rather than assuming that display track numbers are zero-based.
        let id = a
            .get("metadata.uri")
            .or_else(|| a.get("track_id"))
            .ok_or("Identité de piste HQPlayer absente.")?;
        let index = self
            .uris
            .iter()
            .position(|uri| uri == id)
            .ok_or("La piste HQPlayer ne correspond pas à la sélection Aède.")?;
        let position = millis(&a, "position")?;
        let duration = millis(&a, "length")?;
        if let Some((ticket, target)) = self.seek_pending
            && position.abs_diff(target) <= 1200
        {
            self.seek = ticket;
            self.seek_pending = None;
        }
        let db = number(&a, "volume")?;
        let volume = ((db - self.volume_min) / (self.volume_max - self.volume_min)).clamp(0., 1.);
        let shuffled = a.get("random").map(String::as_str) == Some("1");
        self.snapshot = json!({"status":status,"reference":self.tracks[index],"index":index,"total":total,"position_ms":position,"duration_ms":duration,"sample_rate":0,"volume":volume,"history_confirmed":false,"device":OUTPUT,"policy":"hqplayer","error":"","seek_id":self.seek,"level":0,"levels":[0,0,0,0],"shuffled":shuffled,"queue":[]});
        Ok(self.snapshot.clone())
    }
    pub(super) fn control(&mut self, action: &str, value: Value) -> Result<Value, ControlError> {
        let (name, attrs) = match action {
            "mute" => ("VolumeMute", vec![]),
            "pause" => ("Pause", vec![]),
            "resume" => ("Play", vec![]),
            "stop" => ("Stop", vec![]),
            "next" => ("Next", vec![]),
            "previous" => ("Previous", vec![]),
            "jump" => {
                let index = value
                    .as_u64()
                    .filter(|i| *i < self.tracks.len() as u64)
                    .ok_or("Piste HQPlayer invalide.")?;
                ("SelectTrack", vec![("index", index.to_string())])
            }
            "seek" => {
                let ms = value
                    .as_u64()
                    .filter(|ms| *ms <= 604800000)
                    .ok_or("Position invalide.")?;
                let ticket = self
                    .seek_pending
                    .map_or(self.seek, |(ticket, _)| ticket)
                    .checked_add(1)
                    .ok_or("Position invalide.")?;
                self.connection
                    .call("Seek", &[("position", (ms / 1000).to_string())], true)
                    .map_err(ControlError::Transport)?;
                self.seek_pending = Some((ticket, ms));
                return Ok(json!({"seek_id":ticket}));
            }
            "volume" => {
                if !self.volume_enabled {
                    return Err("Activez le volume dans HQPlayer.".into());
                }
                let v = value
                    .as_f64()
                    .filter(|n| n.is_finite() && (0. ..=1.).contains(n))
                    .ok_or("Volume invalide.")?;
                (
                    "Volume",
                    vec![(
                        "value",
                        (self.volume_min + v * (self.volume_max - self.volume_min)).to_string(),
                    )],
                )
            }
            "shuffle" => {
                let enabled = value.as_bool().ok_or("Lecture aléatoire invalide.")?;
                (
                    "SetRandom",
                    vec![("value", if enabled { "1" } else { "0" }.into())],
                )
            }
            "policy" => {
                return Err("Le traitement audio et la sortie sont réglés dans HQPlayer.".into());
            }
            _ => return Err("Commande HQPlayer non prise en charge.".into()),
        };
        self.connection
            .call(name, &attrs, true)
            .map_err(ControlError::Transport)?;
        if action == "jump" {
            self.connection
                .call("Play", &[], true)
                .map_err(ControlError::Transport)?;
        }
        Ok(Value::Null)
    }
}
