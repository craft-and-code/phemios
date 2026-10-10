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
    hq: State<'_, crate::hqplayer::HqPlayer>,
) -> Result<Value, String> {
    bridge(version)?;
    let player = player.inner().clone();
    let available = hq.controller.connected();
    blocking(move || {let mut outputs=player.devices()?; if available {outputs.as_array_mut().ok_or("Sorties audio invalides.")?.push(serde_json::json!({"id":phemios_core::hqplayer::OUTPUT,"name":"HQPlayer","default":false}));} Ok(outputs)}).await
}
#[tauri::command]
pub(crate) async fn playback_state(
    version: u32,
    state: State<'_, Aede>,
    player: State<'_, Arc<Player>>,
    hq: State<'_, crate::hqplayer::HqPlayer>,
) -> Result<Value, String> {
    bridge(version)?;
    let controller = hq.controller.clone();
    let player = player.inner().clone();
    let routing = hq.routing.clone();
    let source = state.playback_source.clone();
    let (snapshot, origin) = blocking(move || {
        let _guard = routing.lock().map_err(|_| "État audio indisponible.")?;
        let origin = *source.lock().map_err(|_| "État audio indisponible.")?;
        let snapshot = if controller.active() {
            controller.snapshot()
        } else {
            player.snapshot()
        }?;
        Ok((snapshot, origin))
    })
    .await?;
    crate::aede::public(snapshot, origin)
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
    hq: State<'_, crate::hqplayer::HqPlayer>,
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
    let owner = state.owner(origin).session.clone();
    let source = state.playback_source.clone();
    let player = player.inner().clone();
    let controller = hq.controller.clone();
    let routing = hq.routing.clone();
    let epoch = hq.epoch.clone();
    let generation = epoch.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
    let mappings = hq.mappings.lock().map_err(|_| "HQPlayer occupé.")?.clone();
    blocking(move || {
        let current = || epoch.load(std::sync::atomic::Ordering::SeqCst) == generation;
        let prepared = if device == phemios_core::hqplayer::OUTPUT {
            Some(phemios_core::hqplayer::Controller::prepare(
                &client,
                tracks.clone(),
                index,
                &mappings,
                current,
            )?)
        } else {
            None
        };
        let _guard = routing.lock().map_err(|_| "État audio indisponible.")?;
        if !current()
            || !owner
                .lock()
                .map_err(|_| "Session native indisponible.")?
                .as_ref()
                .is_some_and(|held| held.same_session(&client))
        {
            return Err("Lecture annulée ou session remplacée.".into());
        }
        player.halt()?;
        controller.halt()?;
        *source.lock().map_err(|_| "État audio indisponible.")? = origin;
        if let Some(selection) = prepared {
            controller.start(selection)
        } else {
            player.start(client, tracks, device, index, &policy)
        }
    })
    .await
}
#[tauri::command]
pub(crate) async fn playback_control(
    version: u32,
    action: String,
    value: Value,
    player: State<'_, Arc<Player>>,
    hq: State<'_, crate::hqplayer::HqPlayer>,
) -> Result<Value, String> {
    bridge(version)?;
    let player = player.inner().clone();
    let controller = hq.controller.clone();
    let routing = hq.routing.clone();
    if action == "stop" {
        hq.epoch.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    }
    blocking(move || {
        let _guard = routing.lock().map_err(|_| "État audio indisponible.")?;
        if controller.active() {
            if action == "stop" {
                controller.halt()?;
                return Ok(Value::Null);
            }
            return controller.control(&action, value);
        }
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
