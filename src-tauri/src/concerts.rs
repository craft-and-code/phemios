//! Public event-directory access with a device-private provider key and no Aède session.
use std::sync::{Arc, Mutex};
use tauri::State;
#[derive(Default)]
pub(crate) struct Concerts(pub(crate) Arc<Mutex<phemios_core::concerts::Directory>>);
#[tauri::command]
pub(crate) async fn concerts_config(
    version: u32,
    key: Option<String>,
    remove: bool,
    aede: State<'_, crate::aede::Aede>,
) -> Result<bool, String> {
    crate::aede::bridge(version)?;
    let engine = aede.engine.clone();
    crate::aede::blocking(move || {
        let engine = engine.lock().map_err(|_| "Configuration occupée.")?;
        if let Some(key) = key {
            engine.set_concert_key(&key, remove)?;
        } else if remove {
            engine.set_concert_key("", true)?;
        }
        Ok(engine.concert_key()?.is_some())
    })
    .await
}
#[tauri::command]
pub(crate) async fn concerts_events(
    version: u32,
    artist: String,
    page: u32,
    state: State<'_, Concerts>,
    aede: State<'_, crate::aede::Aede>,
) -> Result<serde_json::Value, String> {
    crate::aede::bridge(version)?;
    let directory = state.0.clone();
    let engine = aede.engine.clone();
    crate::aede::blocking(move || {
        let key = engine
            .lock()
            .map_err(|_| "Configuration occupée.")?
            .concert_key()?
            .ok_or("Renseignez une clé Ticketmaster pour rechercher les concerts.")?;
        directory
            .try_lock()
            .map_err(|_| "Une recherche de concerts est déjà en cours.")?
            .events(&key, &artist, page)
    })
    .await
}
