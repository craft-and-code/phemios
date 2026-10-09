//! Narrow native API bridge, with process-only sessions and application-owned cache.
use phemios_core::{cache::Cache, network::Client};
use serde_json::Value;
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use tauri::State;

pub(crate) struct SourceState {
    pub(crate) session: Mutex<Option<Client>>,
    pub(crate) cache: Cache,
    pub(crate) snapshot: Mutex<Option<Arc<Value>>>,
}
pub(crate) struct Aede {
    pub(crate) server: SourceState,
    pub(crate) local: SourceState,
    pub(crate) engine: Arc<Mutex<phemios_core::local::Engine>>,
    pub(crate) playback_source: Mutex<phemios_core::federation::Source>,
    pub(crate) downloads: std::path::PathBuf,
}
impl Aede {
    pub(crate) fn owner(&self, source: phemios_core::federation::Source) -> &SourceState {
        match source {
            phemios_core::federation::Source::Local => &self.local,
            phemios_core::federation::Source::Server => &self.server,
        }
    }
}
pub(crate) fn source(value: Option<&str>) -> Result<phemios_core::federation::Source, String> {
    phemios_core::federation::Source::parse(value.unwrap_or("server"))
}
pub(crate) fn public(
    mut value: Value,
    owner: phemios_core::federation::Source,
) -> Result<Value, String> {
    phemios_core::federation::map(&mut value, owner, true)?;
    Ok(value)
}

pub(crate) fn bridge(version: u32) -> Result<(), String> {
    phemios_core::validate_bridge(version).map_err(str::to_owned)
}
pub(crate) fn client(state: &SourceState) -> Result<Client, String> {
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
        .server
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
    if *state
        .playback_source
        .lock()
        .map_err(|_| "État audio indisponible.")?
        == phemios_core::federation::Source::Server
    {
        blocking(move || audio.halt()).await?;
    }
    let session = state
        .server
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
pub(crate) async fn aede_sync(
    version: u32,
    source: Option<String>,
    state: State<'_, Aede>,
) -> Result<Value, String> {
    bridge(version)?;
    let origin = self::source(source.as_deref())?;
    let state = state.owner(origin);
    let client = client(state)?;
    let cache = state.cache.clone();
    let snapshot = blocking(move || cache.save(client.snapshot()?)).await?;
    *state
        .snapshot
        .lock()
        .map_err(|_| "Cache natif indisponible.".to_string())? = Some(Arc::new(snapshot.clone()));
    public(snapshot, origin)
}
#[tauri::command]
pub(crate) async fn aede_cache(
    version: u32,
    source: Option<String>,
    state: State<'_, Aede>,
) -> Result<Option<Value>, String> {
    bridge(version)?;
    let origin = self::source(source.as_deref())?;
    let state = state.owner(origin);
    let cache = state.cache.clone();
    let snapshot = blocking(move || cache.load()).await?;
    *state
        .snapshot
        .lock()
        .map_err(|_| "Cache natif indisponible.".to_string())? = snapshot.clone().map(Arc::new);
    snapshot.map(|value| public(value, origin)).transpose()
}
#[tauri::command]
pub(crate) async fn aede_request(
    version: u32,
    method: String,
    path: String,
    mut query: BTreeMap<String, String>,
    mut body: Option<Value>,
    source: Option<String>,
    state: State<'_, Aede>,
) -> Result<Value, String> {
    bridge(version)?;
    let hint = query
        .get("ref")
        .or_else(|| query.get("reference"))
        .map(String::as_str)
        .or_else(|| {
            body.as_ref()
                .and_then(|v| v["release"].as_str().or_else(|| v["reference"].as_str()))
        });
    let origin = hint
        .map(phemios_core::federation::resolve)
        .transpose()?
        .map(|v| v.0)
        .unwrap_or(self::source(source.as_deref())?);
    for key in ["ref", "reference"] {
        if let Some(reference) = query.get_mut(key) {
            let (owner, raw) = phemios_core::federation::resolve(reference)?;
            if owner != origin {
                return Err("Origines incompatibles.".into());
            }
            *reference = raw;
        }
    }
    if let Some(value) = body.as_mut() {
        phemios_core::federation::map(value, origin, false)?;
    }
    if origin == phemios_core::federation::Source::Local
        && path.starts_with("/api/admin/v1/accounts/phemios-local")
        && method != "GET"
    {
        return Err("Le compte du moteur local est géré par Phémios.".into());
    }
    if origin == phemios_core::federation::Source::Local && path == "/api/auth/v1/password" {
        return Err("Le secret du moteur local est géré par Phémios.".into());
    }
    let client = client(state.owner(origin))?;
    let engine = state.engine.clone();
    blocking(move || {
        if method == "POST" && path == "/api/admin/v1/fetch" {
            if client.account()["account"]["role"] != "admin" {
                return Err("Un administrateur Aède est nécessaire.".into());
            }
            let keys = engine
                .lock()
                .map_err(|_| "Moteur local occupé.")?
                .fetch_keys()?;
            let status = if keys.as_object().is_some_and(|rows| !rows.is_empty()) {
                client.request("GET", "/api/v1/status", &[], None)?
            } else {
                serde_json::json!({})
            };
            phemios_core::enrichment::attach_service_keys(
                body.as_mut().ok_or("Demande d’enrichissement invalide.")?,
                &keys,
                &status,
            )?;
        }
        let query: Vec<_> = query
            .iter()
            .map(|(key, value)| (key.as_str(), value.as_str()))
            .collect();
        public(
            client.request(&method, &path, &query, body.as_ref())?,
            origin,
        )
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
    let (origin, reference) = phemios_core::federation::resolve(&reference)?;
    let state = state.owner(origin);
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
    source: Option<String>,
    state: State<'_, Aede>,
) -> Result<String, String> {
    bridge(version)?;
    let client = client(state.owner(self::source(source.as_deref())?))?;
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
    let (origin, reference) = phemios_core::federation::resolve(&reference)?;
    let client = client(state.owner(origin))?;
    let folder = state.downloads.join(origin.name());
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

#[tauri::command]
pub(crate) async fn aede_download_spectrum(
    version: u32,
    reference: String,
    state: State<'_, Aede>,
) -> Result<String, String> {
    bridge(version)?;
    let (origin, reference) = phemios_core::federation::resolve(&reference)?;
    let client = client(state.owner(origin))?;
    let folder = state.downloads.join(origin.name());
    blocking(move || {
        let bytes = client.spectrum_download(&reference)?;
        let path = phemios_core::download::publish_spectrum(&folder, &reference, &bytes)?;
        Ok(path.to_string_lossy().into_owned())
    })
    .await
}
