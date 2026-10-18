//! Versioned scope-only IPC; no power command, process identifier or OS setting is supplied by the webview.
use crate::{
    aede::{blocking, bridge},
    display_awake::Awake,
};
use std::sync::Arc;
use tauri::State;
#[tauri::command]
pub(crate) async fn awake_open(
    version: u32,
    awake: State<'_, Arc<Awake>>,
) -> Result<String, String> {
    bridge(version)?;
    let awake = awake.inner().clone();
    blocking(move || awake.open()).await
}
#[tauri::command]
pub(crate) async fn awake_update(
    version: u32,
    scope: String,
    active: bool,
    awake: State<'_, Arc<Awake>>,
) -> Result<(), String> {
    bridge(version)?;
    let awake = awake.inner().clone();
    blocking(move || awake.update(&scope, active)).await
}
