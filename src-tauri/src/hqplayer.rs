//! Optional HQPlayer connector; no authenticated Aède URL leaves the application.
use crate::aede::{blocking, bridge};
pub(crate) use crate::hqplayer_state::HqPlayer;
use phemios_core::hqplayer::Controller;
use serde_json::Value;
use tauri::State;
#[tauri::command]
pub(crate) async fn hqplayer_connect(
    version: u32,
    host: String,
    port: u16,
    mappings: Value,
    state: State<'_, HqPlayer>,
) -> Result<Value, String> {
    bridge(version)?;
    if !mappings.as_array().is_some_and(|r| r.len() <= 16) || mappings.to_string().len() > 65536 {
        return Err("Correspondance HQPlayer invalide.".into());
    }
    Controller::validate_mapping(&mappings)?;
    let ticket = state.reserve();
    let state = state.inner().clone();
    blocking(move || state.connect(ticket, &host, port, mappings)).await
}
#[tauri::command]
pub(crate) async fn hqplayer_disconnect(
    version: u32,
    state: State<'_, HqPlayer>,
) -> Result<(), String> {
    bridge(version)?;
    let ticket = state.reserve();
    state
        .epoch
        .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let state = state.inner().clone();
    blocking(move || state.disconnect(ticket)).await
}
