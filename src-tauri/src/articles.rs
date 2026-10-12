//! Retained owner-private articles are separate from public Wikipedia fetch/download operations.
use crate::aede::{Aede, blocking, bridge, client};
use serde_json::Value;
use tauri::State;
#[tauri::command]
pub(crate) async fn article_state(
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
    let store = state.articles.clone();
    blocking(move || {
        crate::sessions::with_current(&held, &generation, &session, &client, || {
            store
                .lock()
                .map_err(|_| "Articles enregistrés occupés.")?
                .read(origin, &client)
        })
    })
    .await
}
#[tauri::command]
pub(crate) async fn article_update(
    version: u32,
    source: String,
    session: String,
    action: String,
    payload: Value,
    state: State<'_, Aede>,
) -> Result<Value, String> {
    bridge(version)?;
    let origin = crate::aede::source(Some(&source))?;
    let client = client(state.owner(origin))?;
    let held = state.owner(origin).session.clone();
    let generation = state.owner(origin).generation.clone();
    let store = state.articles.clone();
    blocking(move || {
        crate::sessions::private_write(&held, &generation, &session, &client, || {
            store
                .lock()
                .map_err(|_| "Articles enregistrés occupés.")?
                .update(origin, &client, &action, &payload)
        })
    })
    .await
}
