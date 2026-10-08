//! Narrow native API bridge, with process-only sessions and application-owned cache.
use phemios_core::{cache::Cache, network::Client};
use serde_json::Value;
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use tauri::State;

pub(crate) struct Aede {
    pub(crate) session: Mutex<Option<Client>>,
    pub(crate) cache: Cache,
    pub(crate) downloads: std::path::PathBuf,
    pub(crate) snapshot: Mutex<Option<Arc<Value>>>,
}
pub(crate) fn bridge(version: u32) -> Result<(), String> {
    phemios_core::validate_bridge(version).map_err(str::to_owned)
}
pub(crate) fn client(state: &Aede) -> Result<Client, String> {
    state
        .session
        .lock()
        .map_err(|_| "Session native indisponible.".to_string())?
        .clone()
        .ok_or_else(|| "Connectez-vous à Aède.".into())
}
pub(crate) async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|_| "Opération native interrompue.".to_string())?
}

#[tauri::command]
pub(crate) async fn aede_login(
    version: u32,
    server: String,
    username: String,
    password: String,
    state: State<'_, Aede>,
) -> Result<Value, String> {
    bridge(version)?;
    let client = blocking(move || Client::login(&server, &username, &password)).await?;
    let account = client.account();
    let mut session = state
        .session
        .lock()
        .map_err(|_| "Session native indisponible.".to_string())?;
    if session.is_some() {
        return Err("Déconnectez la session active avant de changer de compte.".into());
    }
    *session = Some(client);
    Ok(account)
}
#[tauri::command]
pub(crate) async fn aede_logout(
    version: u32,
    state: State<'_, Aede>,
    player: State<'_, std::sync::Arc<phemios_core::playback::Player>>,
) -> Result<(), String> {
    bridge(version)?;
    let audio = player.inner().clone();
    blocking(move || audio.halt()).await?;
    let session = state
        .session
        .lock()
        .map_err(|_| "Session native indisponible.".to_string())?
        .take();
    if let Some(client) = session {
        blocking(move || client.request("DELETE", "/api/auth/v1/session", &[], None)).await?;
    }
    Ok(())
}
#[tauri::command]
pub(crate) async fn aede_sync(version: u32, state: State<'_, Aede>) -> Result<Value, String> {
    bridge(version)?;
    let client = client(&state)?;
    let cache = state.cache.clone();
    let snapshot = blocking(move || cache.save(client.snapshot()?)).await?;
    *state
        .snapshot
        .lock()
        .map_err(|_| "Cache natif indisponible.".to_string())? = Some(Arc::new(snapshot.clone()));
    Ok(snapshot)
}
#[tauri::command]
pub(crate) async fn aede_cache(
    version: u32,
    state: State<'_, Aede>,
) -> Result<Option<Value>, String> {
    bridge(version)?;
    let cache = state.cache.clone();
    let snapshot = blocking(move || cache.load()).await?;
    *state
        .snapshot
        .lock()
        .map_err(|_| "Cache natif indisponible.".to_string())? = snapshot.clone().map(Arc::new);
    Ok(snapshot)
}
#[tauri::command]
pub(crate) async fn aede_request(
    version: u32,
    method: String,
    path: String,
    query: BTreeMap<String, String>,
    body: Option<Value>,
    state: State<'_, Aede>,
) -> Result<Value, String> {
    bridge(version)?;
    let client = client(&state)?;
    blocking(move || {
        let query: Vec<_> = query
            .iter()
            .map(|(key, value)| (key.as_str(), value.as_str()))
            .collect();
        client.request(&method, &path, &query, body.as_ref())
    })
    .await
}
#[tauri::command]
pub(crate) async fn aede_artwork(
    version: u32,
    reference: String,
    kind: String,
    state: State<'_, Aede>,
) -> Result<tauri::ipc::Response, String> {
    bridge(version)?;
    let cache = state.cache.clone();
    let session = state
        .session
        .lock()
        .map_err(|_| "Session native indisponible.".to_string())?
        .clone();
    let snapshot = state
        .snapshot
        .lock()
        .map_err(|_| "Cache natif indisponible.".to_string())?
        .clone()
        .ok_or("Synchronisez le catalogue avant les images.")?;
    blocking(move || {
        if let Some(bytes) = cache.image(&snapshot, &reference, &kind)? {
            return Ok(bytes);
        }
        let client = session
            .ok_or("Cette image n’a pas encore été mise en cache. Connectez-vous à Aède.")?;
        let account = client.account();
        if snapshot["server"] != account["server"]
            || snapshot["accountId"] != account["account"]["id"]
        {
            return Err("Synchronisez le compte connecté avant ses images.".into());
        }
        let bytes = client.artwork(&reference, &kind)?;
        cache.save_image(&snapshot, &reference, &kind, &bytes)?;
        Ok(bytes)
    })
    .await
    .map(tauri::ipc::Response::new)
}

#[tauri::command]
pub(crate) async fn aede_download(
    version: u32,
    id: String,
    state: State<'_, Aede>,
) -> Result<String, String> {
    bridge(version)?;
    let client = client(&state)?;
    let folder = state.downloads.clone();
    blocking(move || {
        let response = client.request("GET", &format!("/api/me/v1/m3u/{id}"), &[], None)?;
        let path = phemios_core::download::publish(&folder, &id, &response)?;
        Ok(path.to_string_lossy().into_owned())
    })
    .await
}

#[tauri::command]
pub(crate) async fn aede_download_analysis(
    version: u32,
    reference: String,
    state: State<'_, Aede>,
) -> Result<String, String> {
    bridge(version)?;
    let client = client(&state)?;
    let folder = state.downloads.clone();
    blocking(move || {
        let response = client.request(
            "GET",
            "/api/v1/analysis/report",
            &[("ref", reference.as_str())],
            None,
        )?;
        let path = phemios_core::download::publish_analysis(&folder, &reference, &response)?;
        Ok(path.to_string_lossy().into_owned())
    })
    .await
}
