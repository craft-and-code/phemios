//! Optional HQPlayer connector; no authenticated Aède URL leaves the application.
use crate::aede::{blocking, bridge};
use phemios_core::hqplayer::Controller;
use serde_json::{Value, json};
use std::sync::{Arc, Mutex};
use tauri::State;
pub(crate) struct HqPlayer {
    pub controller: Arc<Controller>,
    pub mappings: Arc<Mutex<Value>>,
    pub routing: Arc<Mutex<()>>,
    pub epoch: Arc<std::sync::atomic::AtomicU64>,
}
impl Default for HqPlayer {
    fn default() -> Self {
        Self {
            controller: Arc::new(Controller::default()),
            mappings: Arc::new(Mutex::new(json!([]))),
            routing: Arc::new(Mutex::new(())),
            epoch: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }
}
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
    let controller = state.controller.clone();
    let routing = state.routing.clone();
    let saved = state.mappings.clone();
    blocking(move || {
        let _guard = routing.lock().map_err(|_| "HQPlayer occupé.")?;
        let result = controller.connect(&host, port)?;
        *saved.lock().map_err(|_| "HQPlayer occupé.")? = mappings;
        Ok(result)
    })
    .await
}
#[tauri::command]
pub(crate) async fn hqplayer_disconnect(
    version: u32,
    state: State<'_, HqPlayer>,
) -> Result<(), String> {
    bridge(version)?;
    let controller = state.controller.clone();
    state
        .epoch
        .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let routing = state.routing.clone();
    blocking(move || {
        let _guard = routing.lock().map_err(|_| "HQPlayer occupé.")?;
        controller.disconnect()
    })
    .await
}
