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
    player: State<'_, Arc<Player>>,
) -> Result<Value, String> {
    bridge(version)?;
    player.snapshot()
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
    let client = client(&state)?;
    let player = player.inner().clone();
    blocking(move || player.start(client, tracks, device, index, &policy)).await
}
#[tauri::command]
pub(crate) async fn playback_control(
    version: u32,
    action: String,
    value: Value,
    player: State<'_, Arc<Player>>,
) -> Result<(), String> {
    bridge(version)?;
    let player = player.inner().clone();
    blocking(move || {
        if action == "stop" {
            player.halt()
        } else {
            player.control(&action, value)
        }
    })
    .await
}
