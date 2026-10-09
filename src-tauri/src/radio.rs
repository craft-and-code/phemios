//! Narrow explicit directory commands with no Aède session or arbitrary proxy URL.
use serde_json::Value;
use std::sync::{Arc, Mutex};
use tauri::State;
pub(crate) struct Radio(pub(crate) Arc<Mutex<phemios_core::radio::Directory>>);
async fn run(
    state: &Radio,
    version: u32,
    operation: impl FnOnce(&mut phemios_core::radio::Directory) -> Result<Value, String>
    + Send
    + 'static,
) -> Result<Value, String> {
    crate::aede::bridge(version)?;
    let directory = state.0.clone();
    crate::aede::blocking(move || {
        let mut client = directory
            .try_lock()
            .map_err(|_| "Une demande radio est déjà en cours. Réessayez.")?;
        operation(&mut client)
    })
    .await
}
#[tauri::command]
pub(crate) async fn radio_search(
    version: u32,
    name: String,
    country: String,
    tag: String,
    offset: u32,
    secure_only: bool,
    state: State<'_, Radio>,
) -> Result<Value, String> {
    run(&state, version, move |directory| {
        directory.search(&name, &country, &tag, offset, secure_only)
    })
    .await
}
#[tauri::command]
pub(crate) async fn radio_statistics(
    version: u32,
    state: State<'_, Radio>,
) -> Result<Value, String> {
    run(&state, version, |directory| directory.statistics()).await
}
#[tauri::command]
pub(crate) async fn radio_resolve(
    version: u32,
    uuid: String,
    state: State<'_, Radio>,
) -> Result<Value, String> {
    run(&state, version, move |directory| directory.resolve(&uuid)).await
}
