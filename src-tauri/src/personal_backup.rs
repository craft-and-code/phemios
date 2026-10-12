//! Explicit account-private backup/restore; native identity and ticket select the stores.
use crate::aede::{Aede, blocking, bridge, client};
use serde_json::Value;
use tauri::State;
#[tauri::command]
pub(crate) async fn personal_backup_read(
    version: u32,
    source: String,
    session: String,
    state: State<'_, Aede>,
) -> Result<Value, String> {
    bridge(version)?;
    let origin = crate::aede::source(Some(&source))?;
    let client = client(state.owner(origin))?;
    let held = state.owner(origin).session.clone();
    let generation = state.owner(origin).generation.clone();
    let podcasts = state.podcasts.clone();
    let articles = state.articles.clone();
    blocking(move || {
        crate::sessions::with_current(&held, &generation, &session, &client, || {
            let podcasts = podcasts.lock().map_err(|_| "Données podcasts occupées.")?;
            let articles = articles
                .lock()
                .map_err(|_| "Articles enregistrés occupés.")?;
            phemios_core::personal_backup::read(&podcasts, &articles, origin, &client)
        })
    })
    .await
}
#[tauri::command]
pub(crate) async fn personal_backup_restore(
    version: u32,
    source: String,
    session: String,
    payload: Value,
    state: State<'_, Aede>,
) -> Result<(), String> {
    bridge(version)?;
    let origin = crate::aede::source(Some(&source))?;
    let client = client(state.owner(origin))?;
    let held = state.owner(origin).session.clone();
    let generation = state.owner(origin).generation.clone();
    let podcasts = state.podcasts.clone();
    let articles = state.articles.clone();
    blocking(move || {
        crate::sessions::private_write(&held, &generation, &session, &client, || {
            let podcasts = podcasts.lock().map_err(|_| "Données podcasts occupées.")?;
            let articles = articles
                .lock()
                .map_err(|_| "Articles enregistrés occupés.")?;
            phemios_core::personal_backup::restore(&podcasts, &articles, origin, &client, &payload)
        })
    })
    .await
}
