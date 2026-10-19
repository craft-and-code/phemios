//! Native-only folder picker and application-owned Aède lifecycle.
use crate::aede::{Aede, blocking, bridge, client};
use serde_json::{Value, json};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
#[tauri::command]
pub(crate) async fn local_status(version: u32, state: State<'_, Aede>) -> Result<Value, String> {
    bridge(version)?;
    let engine = state.engine.clone();
    blocking(move || engine.lock().map_err(|_| "Moteur local occupé.")?.status()).await
}
#[tauri::command]
pub(crate) async fn local_start(version: u32, state: State<'_, Aede>) -> Result<Value, String> {
    bridge(version)?;
    let generation = state
        .local
        .generation
        .load(std::sync::atomic::Ordering::SeqCst);
    let engine = state.engine.clone();
    let client =
        blocking(move || engine.lock().map_err(|_| "Moteur local occupé.")?.start()).await?;
    crate::sessions::publish_login(
        &state.local.session,
        &state.local.generation,
        generation,
        client,
        true,
    )
}
#[tauri::command]
pub(crate) async fn local_stop(
    version: u32,
    state: State<'_, Aede>,
    player: State<'_, std::sync::Arc<phemios_core::playback::Player>>,
    hq: State<'_, crate::hqplayer::HqPlayer>,
) -> Result<(), String> {
    bridge(version)?;
    hq.epoch.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    crate::sessions::invalidate(&state.local.session, &state.local.generation)?;
    let player = player.inner().clone();
    let controller = hq.controller.clone();
    let routing = hq.routing.clone();
    let source = state.playback_source.clone();
    let engine = state.engine.clone();
    blocking(move || {
        phemios_core::session_cleanup::complete(
            || {
                let _guard = routing.lock().map_err(|_| "État audio indisponible.")?;
                if *source.lock().map_err(|_| "État audio indisponible.")?
                    == phemios_core::federation::Source::Local
                {
                    return phemios_core::session_cleanup::complete(
                        || player.halt(),
                        || controller.halt(),
                    );
                }
                Ok(())
            },
            || engine.lock().map_err(|_| "Moteur local occupé.")?.stop(),
        )
    })
    .await
}

#[tauri::command]
pub(crate) async fn local_pick_roots(
    version: u32,
    app: AppHandle,
    state: State<'_, Aede>,
) -> Result<(), String> {
    bridge(version)?;
    let engine = state.engine.clone();
    blocking(move || {
        let Some(files) = app.dialog().file().blocking_pick_folders() else {
            return Ok(());
        };
        let paths = files
            .into_iter()
            .map(|file| {
                file.into_path()
                    .map_err(|_| "Dossier natif invalide.".to_owned())
            })
            .collect::<Result<Vec<_>, _>>()?;
        engine
            .lock()
            .map_err(|_| "Moteur local occupé.")?
            .add_roots(&paths)
    })
    .await
}
#[tauri::command]
pub(crate) async fn local_scan(
    version: u32,
    full: bool,
    threads: u64,
    state: State<'_, Aede>,
) -> Result<Value, String> {
    bridge(version)?;
    let client = client(&state.local)?;
    let engine = state.engine.clone();
    blocking(move || {
        let body = engine
            .lock()
            .map_err(|_| "Moteur local occupé.")?
            .scan_request(full, threads)?;
        let result = client.request("POST", "/api/admin/v1/scan", &[], Some(&body))?;
        engine
            .lock()
            .map_err(|_| "Moteur local occupé.")?
            .accepted_scan()?;
        Ok(result)
    })
    .await
}
#[tauri::command]
pub(crate) async fn local_root_action(
    version: u32,
    path: String,
    action: String,
    state: State<'_, Aede>,
) -> Result<(), String> {
    bridge(version)?;
    let engine = state.engine.clone();
    blocking(move || {
        engine
            .lock()
            .map_err(|_| "Moteur local occupé.")?
            .root_action(&path, &action)
    })
    .await
}
#[tauri::command]
pub(crate) async fn local_keys(
    version: u32,
    fanart: String,
    acoustid: String,
    remove_fanart: bool,
    remove_acoustid: bool,
    state: State<'_, Aede>,
) -> Result<Value, String> {
    bridge(version)?;
    let engine = state.engine.clone();
    blocking(move || {
        let mut engine = engine.lock().map_err(|_| "Moteur local occupé.")?;
        engine.keys(&fanart, &acoustid, remove_fanart, remove_acoustid)?;
        Ok(json!({"restartRequired":true}))
    })
    .await
}
