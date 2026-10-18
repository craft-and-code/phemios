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
) -> Result<serde_json::Value, String> {
    crate::aede::bridge(version)?;
    let engine = aede.engine.clone();
    crate::aede::blocking(move || {
        let engine = engine.lock().map_err(|_| "Configuration occupée.")?;
        engine.configure_concerts(key.as_deref(), remove)
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
        let mut directory = directory
            .try_lock()
            .map_err(|_| "Une recherche de concerts est déjà en cours.")?;
        let (key, mut budget) = {
            let engine = engine.lock().map_err(|_| "Configuration occupée.")?;
            (
                engine
                    .concert_key()?
                    .ok_or("Renseignez une clé JamBase pour rechercher les concerts.")?,
                engine.concert_budget()?,
            )
        };
        directory.events(&key, &artist, page, &mut budget)
    })
    .await
}
