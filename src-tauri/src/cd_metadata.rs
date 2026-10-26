//! Optional public metadata requests never retain the optical registry or playback routing lock.
use crate::{
    aede::{blocking, bridge},
    cd::Cd,
};
use serde_json::{Value, json};
use std::sync::{Mutex, OnceLock};
use tauri::State;
static CLIENT: OnceLock<Mutex<phemios_core::cd_metadata::Client>> = OnceLock::new();
#[tauri::command]
pub(crate) async fn cd_identify(
    version: u32,
    token: String,
    cd: State<'_, Cd>,
) -> Result<Value, String> {
    bridge(version)?;
    let cd = cd.0.clone();
    blocking(move || {
        let disc = cd
            .lock()
            .map_err(|_| "Lecteurs CD indisponibles.")?
            .disc(&token)?;
        let toc = disc
            .identification_toc()
            .ok_or("Ce CD ne permet pas l’identification automatique.")?;
        let metadata = CLIENT
            .get_or_init(Default::default)
            .try_lock()
            .map_err(|_| "Identification MusicBrainz indisponible. La lecture reste disponible.")?
            .identify(&toc)?;
        // Reject an ejected/replaced selection without probing a drive during audio playback.
        cd.lock()
            .map_err(|_| "Lecteurs CD indisponibles.")?
            .disc(&token)?;
        Ok(json!({"token":token,"metadata":metadata}))
    })
    .await
}
