//! Versioned audio IPC exposes catalog references and public state only.
use crate::aede::{Aede, blocking, bridge, client};
use phemios_core::playback::Player;
use serde_json::Value;
use std::sync::Arc;
use tauri::State;
#[tauri::command]
pub(crate) async fn playback_devices(
    version: u32,
    player: State<'_, Arc<Player>>,
) -> Result<Value, String> {
    bridge(version)?;
    let player = player.inner().clone();
    blocking(move || player.devices()).await
}
#[tauri::command]
pub(crate) fn playback_state(
    version: u32,
    state: State<'_, Aede>,
    player: State<'_, Arc<Player>>,
) -> Result<Value, String> {
    bridge(version)?;
    crate::aede::public(
        player.snapshot()?,
        *state
            .playback_source
            .lock()
            .map_err(|_| "État audio indisponible.")?,
    )
}
#[tauri::command]
pub(crate) async fn playback_start(
    version: u32,
    tracks: Vec<String>,
    device: String,
    index: usize,
    policy: String,
    player: State<'_, Arc<Player>>,
    state: State<'_, Aede>,
) -> Result<(), String> {
    bridge(version)?;
    let (origin, _) = phemios_core::federation::resolve(tracks.first().ok_or("Sélection vide.")?)?;
    let tracks = tracks
        .iter()
        .map(|reference| {
            let (source, raw) = phemios_core::federation::resolve(reference)?;
            if source != origin {
                return Err(
                    "Lecture de plusieurs origines non prise en charge dans une seule file.".into(),
                );
            }
            Ok(raw)
        })
        .collect::<Result<Vec<_>, String>>()?;
    let client = client(state.owner(origin))?;
    *state
        .playback_source
        .lock()
        .map_err(|_| "État audio indisponible.")? = origin;
    let player = player.inner().clone();
    blocking(move || player.start(client, tracks, device, index, &policy)).await
}
#[tauri::command]
pub(crate) async fn playback_control(
    version: u32,
    action: String,
    value: Value,
    player: State<'_, Arc<Player>>,
) -> Result<Value, String> {
    bridge(version)?;
    let player = player.inner().clone();
    blocking(move || {
        if action == "seek" {
            return player
                .seek(value.as_u64().ok_or("Position invalide.")?)
                .map(|ticket| serde_json::json!({"seek_id": ticket}));
        }
        if action == "stop" {
            player.halt()?;
        } else {
            player.control(&action, value)?;
        }
        Ok(Value::Null)
    })
    .await
}
