//! Shared-folder HQPlayer output. The separate engine owns DSP and DAC access.
mod paths;
mod protocol;
mod session;
use protocol::Connection;
use serde_json::{Value, json};
use session::number;
use std::sync::Mutex;
/// Reserved output identifier, never confused with a native audio-device name.
pub const OUTPUT: &str = "@hqplayer";
struct Session {
    connection: Connection,
    tracks: Vec<String>,
    uris: Vec<String>,
    snapshot: Value,
    volume_min: f64,
    volume_max: f64,
    volume_enabled: bool,
    seek: u64,
    seek_pending: Option<(u64, u64)>,
    active: bool,
}
/// Verified source paths; private fields prevent arbitrary URI construction across the bridge.
pub struct Selection {
    tracks: Vec<String>,
    uris: Vec<String>,
    index: usize,
}
/// One socket owner serializes all protocol requests and acknowledged transport changes.
#[derive(Default)]
pub struct Controller {
    session: Mutex<Option<Session>>,
}
impl Controller {
    /// Explicit non-mutating connection probe. Never opens during ordinary navigation.
    pub fn connect(&self, host: &str, port: u16) -> Result<Value, String> {
        let mut guard = self.session.lock().map_err(|_| "HQPlayer occupé.")?;
        if guard.as_ref().is_some_and(|s| s.active) {
            return Err("Arrêtez la lecture HQPlayer avant de modifier sa connexion.".into());
        }
        *guard = None;
        let mut connection = Connection::connect(host, port)?;
        let info = connection.call("GetInfo", &[], false)?;
        if !["product", "version"].iter().all(|key| {
            info.get(*key)
                .is_some_and(|v| !v.is_empty() && v.len() <= 256)
        }) {
            return Err("Cette adresse ne répond pas comme HQPlayer.".into());
        }
        let range = connection.call("VolumeRange", &[], false)?;
        let min = number(&range, "min")?;
        let max = number(&range, "max")?;
        if min < -200. || max > 20. || min >= max {
            return Err("Volume HQPlayer invalide.".into());
        }
        connection.call("Status", &[("subscribe", "0".into())], false)?;
        *guard = Some(Session {
            connection,
            tracks: Vec::new(),
            uris: Vec::new(),
            snapshot: Value::Null,
            volume_min: min,
            volume_max: max,
            volume_enabled: range.get("enabled").map(String::as_str) == Some("1"),
            seek: 0,
            seek_pending: None,
            active: false,
        });
        Ok(
            json!({"connected":true,"product":info.get("product"),"version":info.get("version"),"name":info.get("name")}),
        )
    }
    /// Validate mappings before attempting a connection or saving an active profile.
    pub fn validate_mapping(value: &Value) -> Result<(), String> {
        paths::uri("/fixture", value).map(|_| ())
    }
    /// Expose verified availability without making a discovery network request.
    pub fn connected(&self) -> bool {
        self.session.lock().is_ok_and(|s| s.is_some())
    }
    /// Route audio controls only after an explicit selection has been accepted.
    pub fn active(&self) -> bool {
        self.session
            .lock()
            .is_ok_and(|s| s.as_ref().is_some_and(|s| s.active))
    }
    /// Stop only this controller's queue; unrelated HQPlayer playback is untouched.
    pub fn halt(&self) -> Result<(), String> {
        self.stop(false)
    }
    /// Stop an owned selection and drop its retained metadata without disconnecting the output.
    pub fn clear(&self) -> Result<(), String> {
        self.stop(true)
    }
    fn stop(&self, clear: bool) -> Result<(), String> {
        let mut held = self.session.lock().map_err(|_| "HQPlayer occupé.")?;
        if let Some(s) = held.as_mut()
            && s.active
        {
            let result = s.connection.call("Stop", &[], true);
            s.active = false;
            if result.is_err() {
                *held = None;
            }
            result?;
        }
        if clear && let Some(s) = held.as_mut() {
            s.tracks.clear();
            s.uris.clear();
            s.snapshot = Value::Null;
            s.seek = 0;
            s.seek_pending = None;
        }
        Ok(())
    }
    /// Remove the optional endpoint after stopping an owned queue.
    pub fn disconnect(&self) -> Result<(), String> {
        let result = self.halt();
        *self.session.lock().map_err(|_| "HQPlayer occupé.")? = None;
        result
    }
    /// Prepare source-confined files without touching the external playlist; cancelled sessions stop retrieval.
    pub fn prepare(
        client: &crate::network::Client,
        tracks: Vec<String>,
        index: usize,
        mappings: &Value,
        current: impl Fn() -> bool,
    ) -> Result<Selection, String> {
        if !matches!(
            client.account()["account"]["role"].as_str(),
            Some("admin" | "user")
        ) {
            return Err("Votre compte ne permet pas la lecture.".into());
        }
        if tracks.is_empty() || tracks.len() > 4096 || index >= tracks.len() {
            return Err("Sélection limitée à 4096 pistes.".into());
        }
        let mut uris = Vec::new();
        for reference in &tracks {
            if !current() {
                return Err("Lecture annulée ou session remplacée.".into());
            }
            let detail = client.request_admitted(
                "GET",
                "/api/v1/track",
                &[("ref", reference)],
                None,
                || {
                    if current() {
                        Ok(())
                    } else {
                        Err("Lecture annulée ou session remplacée.".into())
                    }
                },
            )?;
            if detail["reference"].as_str() != Some(reference) {
                return Err("Identité de piste Aède invalide.".into());
            }
            uris.push(paths::uri(
                detail["path"]
                    .as_str()
                    .ok_or("Chemin de piste Aède indisponible.")?,
                mappings,
            )?);
        }
        if !current() {
            return Err("Lecture annulée ou session remplacée.".into());
        }
        if uris.iter().collect::<std::collections::HashSet<_>>().len() != uris.len() {
            return Err(
                "HQPlayer ne peut pas identifier plusieurs pistes partageant ce fichier.".into(),
            );
        }
        Ok(Selection {
            tracks,
            uris,
            index,
        })
    }
    /// Publish only a selection prepared from the authenticated catalog, never arbitrary frontend paths.
    pub fn start(&self, selection: Selection) -> Result<(), String> {
        self.start_uris(selection.tracks, selection.uris, selection.index)
    }
    fn start_uris(
        &self,
        tracks: Vec<String>,
        uris: Vec<String>,
        index: usize,
    ) -> Result<(), String> {
        let mut held = self.session.lock().map_err(|_| "HQPlayer occupé.")?;
        let s = held
            .as_mut()
            .ok_or("Testez la connexion HQPlayer dans les paramètres.")?;
        let result = (|| {
            s.connection.call("Stop", &[], true)?;
            for (i, uri) in uris.iter().enumerate() {
                s.connection.call(
                    "PlaylistAdd",
                    &[
                        ("uri", uri.clone()),
                        ("queued", "0".into()),
                        ("clear", if i == 0 { "1" } else { "0" }.into()),
                        ("start", "0".into()),
                        ("freewheel", "0".into()),
                    ],
                    true,
                )?;
            }
            s.connection
                .call("SelectTrack", &[("index", index.to_string())], true)?;
            s.connection.call("Play", &[], true)?;
            Ok::<(), String>(())
        })();
        if result.is_err() {
            let _ = s.connection.call("Stop", &[], true);
            *held = None;
            return result;
        }
        s.tracks = tracks;
        s.uris = uris;
        s.active = true;
        s.seek_pending = None;
        s.snapshot = Value::Null;
        Ok(())
    }
    /// Read the engine's actual track clock. Meter data and confirmed Aède history are unavailable.
    pub fn snapshot(&self) -> Result<Value, String> {
        let mut held = self.session.lock().map_err(|_| "HQPlayer occupé.")?;
        let s = held.as_mut().ok_or("Connexion HQPlayer perdue.")?;
        let result = s.read_state();
        if result.is_err() {
            let _ = s.connection.call("Stop", &[], true);
            *held = None;
        }
        result
    }
    /// Typed controls cannot transmit arbitrary XML or open an arbitrary media URL.
    pub fn control(&self, action: &str, value: Value) -> Result<Value, String> {
        let mut held = self.session.lock().map_err(|_| "HQPlayer occupé.")?;
        let s = held.as_mut().ok_or("Connexion HQPlayer perdue.")?;
        let result = s.control(action, value);
        if result.is_err() && !matches!(action, "policy" | "output") {
            let _ = s.connection.call("Stop", &[], true);
            *held = None;
        }
        result
    }
}
#[cfg(test)]
#[path = "tests.rs"]
mod tests;

#[cfg(test)]
#[path = "clear_tests.rs"]
mod clear_tests;
