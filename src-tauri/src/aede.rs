//! Narrow native API bridge, with process-only sessions and application-owned cache.
use phemios_core::{cache::Cache, network::Client};
use serde_json::Value;
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use tauri::State;

pub(crate) struct SourceState {
    pub(crate) session: Arc<Mutex<Option<Client>>>,
    pub(crate) generation: Arc<std::sync::atomic::AtomicU64>,
    pub(crate) cache: Cache,
    pub(crate) snapshot: crate::snapshots::Snapshot,
}
pub(crate) struct Aede {
    pub(crate) server: SourceState,
    pub(crate) local: SourceState,
    pub(crate) engine: Arc<Mutex<phemios_core::local::Engine>>,
    pub(crate) playback_source: Arc<Mutex<phemios_core::federation::Source>>,
    pub(crate) articles: Arc<Mutex<phemios_core::article_store::Store>>,
    pub(crate) podcasts: Arc<Mutex<phemios_core::podcast_store::Store>>,
    // Exact OS Downloads directory, shared by direct exports; never ascend or append a category.
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
    certificate: Option<Vec<u8>>,
    state: State<'_, Aede>,
) -> Result<Value, String> {
    bridge(version)?;
    let generation = state
        .server
        .generation
        .load(std::sync::atomic::Ordering::SeqCst);
    let client = blocking(move || match certificate {
        Some(certificate) => Client::login_pinned(&server, &username, &password, &certificate),
        None => Client::login(&server, &username, &password),
    })
    .await?;
    let account = crate::sessions::publish_login(
        &state.server.session,
        &state.server.generation,
        generation,
        client.clone(),
        false,
    )?;
    if account["account"]["parental_enabled"] == true {
        crate::sessions::with_current(
            &state.server.session,
            &state.server.generation,
            account["nativeSession"]
                .as_str()
                .ok_or("Session native indisponible.")?,
            &client,
            || {
                *state
                    .server
                    .snapshot
                    .lock()
                    .map_err(|_| "Cache natif indisponible.")? = None;
                Ok(())
            },
        )?;
    }
    Ok(account)
}
#[tauri::command]
pub(crate) async fn aede_logout(
    version: u32,
    state: State<'_, Aede>,
    player: State<'_, std::sync::Arc<phemios_core::playback::Player>>,
    hq: State<'_, crate::hqplayer::HqPlayer>,
) -> Result<(), String> {
    bridge(version)?;
    hq.epoch.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let session = crate::sessions::invalidate(&state.server.session, &state.server.generation)?;
    let player = player.inner().clone();
    let controller = hq.controller.clone();
    let routing = hq.routing.clone();
    let source = state.playback_source.clone();
    blocking(move || {
        let _guard = routing.lock().map_err(|_| "État audio indisponible.")?;
        if *source.lock().map_err(|_| "État audio indisponible.")?
            == phemios_core::federation::Source::Server
        {
            player.halt()?;
            controller.halt()?;
        }
        Ok(())
    })
    .await?;
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
    let session = state.session.clone();
    let retained = state.snapshot.clone();
    let snapshot =
        blocking(move || crate::snapshots::synchronize(session, retained, cache, client)).await?;
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
    let retained = state.snapshot.clone();
    let session = state.session.clone();
    let snapshot = blocking(move || {
        let client = session
            .lock()
            .map_err(|_| "Session native indisponible.")?
            .clone();
        if let Some(client) = client
            && client
                .parental_status()?
                .is_some_and(|value| value["policy"]["enabled"] == true)
        {
            let snapshot = retained
                .lock()
                .map_err(|_| "Cache natif indisponible.")?
                .clone();
            return snapshot
                .map(|value| {
                    client.admit_snapshot(&value)?;
                    Ok(value.as_ref().clone())
                })
                .transpose();
        }
        crate::snapshots::load(cache, retained)
    })
    .await?;
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
    expected_session: Option<String>,
    state: State<'_, Aede>,
) -> Result<Value, String> {
    bridge(version)?;
    let origin = phemios_core::federation::request_origin(
        &mut query,
        &mut body,
        self::source(source.as_deref())?,
    )?;
    if origin == phemios_core::federation::Source::Local
        && path.starts_with("/api/admin/v1/accounts/phemios-local")
        && method != "GET"
    {
        return Err("Le compte du moteur local est géré par Phémios.".into());
    }
    if origin == phemios_core::federation::Source::Local && path == "/api/auth/v1/password" {
        return Err("Le secret du moteur local est géré par Phémios.".into());
    }
    // Owner-bearing reads and all mutations must retain the frontend's original
    // process ticket; choosing whichever client is current after IPC queuing is unsafe.
    if expected_session.is_none()
        && (method != "GET"
            || path.starts_with("/api/me/")
            || path.starts_with("/api/auth/")
            || path.starts_with("/api/admin/"))
    {
        return Err("Session remplacée ou déconnectée. Reconnectez-vous.".into());
    }
    let client = client(state.owner(origin))?;
    let session = state.owner(origin).session.clone();
    let generation = state.owner(origin).generation.clone();
    let engine = state.engine.clone();
    blocking(move || {
        crate::sessions::scoped_dispatch(
            &session,
            &generation,
            expected_session.as_deref(),
            &client,
            || {
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
                crate::sessions::scoped_dispatch(
                    &session,
                    &generation,
                    expected_session.as_deref(),
                    &client,
                    || {
                        public(
                            client.request(&method, &path, &query, body.as_ref())?,
                            origin,
                        )
                    },
                )
            },
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
    // Capture before the client: even a guest cache read must not outlive a later child login.
    let generation = state.generation.clone();
    let ticket = generation.load(std::sync::atomic::Ordering::SeqCst);
    let sessions = state.session.clone();
    let cache = state.cache.clone();
    let session = sessions
        .lock()
        .map_err(|_| "Session native indisponible.".to_string())?
        .clone();
    let snapshot = state
        .snapshot
        .lock()
        .map_err(|_| "Cache natif indisponible.".to_string())?
        .clone()
        .ok_or("Synchronisez le catalogue avant les images.")?;
    let bytes = blocking(move || {
        crate::sessions::generation_dispatch(&sessions, &generation, ticket, || {
            if let Some(client) = &session {
                crate::snapshots::admit_artwork(client, &snapshot, &reference)?;
            }
            if let Some(bytes) =
                crate::sessions::with_generation(&sessions, &generation, ticket, || {
                    cache.image(&snapshot, &reference, &kind)
                })?
            {
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
            crate::sessions::with_generation(&sessions, &generation, ticket, || {
                cache.save_image(&snapshot, &reference, &kind, &bytes)
            })?;
            Ok(bytes)
        })
    })
    .await?;
    crate::sessions::with_generation(&state.session, &state.generation, ticket, || {
        Ok(tauri::ipc::Response::new(bytes))
    })
}

#[tauri::command]
pub(crate) async fn aede_missing_cover(
    version: u32,
    artist: String,
    group: String,
    download: bool,
    state: State<'_, Aede>,
) -> Result<tauri::ipc::Response, String> {
    bridge(version)?;
    let (origin, artist) = phemios_core::federation::resolve(&artist)?;
    let state = state.owner(origin);
    // Capture before the client: even a guest cache read must not outlive a later child login.
    let generation = state.generation.clone();
    let ticket = generation.load(std::sync::atomic::Ordering::SeqCst);
    let sessions = state.session.clone();
    let cache = state.cache.clone();
    let session = sessions
        .lock()
        .map_err(|_| "Session native indisponible.".to_string())?
        .clone();
    let snapshot = state
        .snapshot
        .lock()
        .map_err(|_| "Cache natif indisponible.".to_string())?
        .clone()
        .ok_or("Synchronisez le catalogue avant les images.")?;
    let bytes = blocking(move || {
        crate::sessions::generation_dispatch(&sessions, &generation, ticket, || {
            if let Some(client) = &session {
                crate::snapshots::admit_artwork(client, &snapshot, &artist)?;
            }
            if group.len() != 36
                || !group.bytes().enumerate().all(|(i, b)| {
                    if [8, 13, 18, 23].contains(&i) {
                        b == b'-'
                    } else {
                        b.is_ascii_hexdigit()
                    }
                })
            {
                return Err("Album manquant Aède invalide.".into());
            }
            let kind = format!("missing-cover:{group}");
            if let Some(bytes) =
                crate::sessions::with_generation(&sessions, &generation, ticket, || {
                    cache.image(&snapshot, &artist, &kind)
                })?
            {
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
            let bytes = client.missing_cover(&artist, &group, download)?;
            if !bytes.is_empty() {
                crate::sessions::with_generation(&sessions, &generation, ticket, || {
                    cache.save_image(&snapshot, &artist, &kind, &bytes)
                })?;
            }
            Ok(bytes)
        })
    })
    .await?;
    crate::sessions::with_generation(&state.session, &state.generation, ticket, || {
        Ok(tauri::ipc::Response::new(bytes))
    })
}

#[tauri::command]
pub(crate) async fn aede_download(
    version: u32,
    id: String,
    source: Option<String>,
    expected_session: Option<String>,
    state: State<'_, Aede>,
) -> Result<String, String> {
    bridge(version)?;
    let ticket = expected_session.ok_or("Session invalide.")?;
    let owner = state.owner(self::source(source.as_deref())?);
    let client = client(owner)?;
    let session = owner.session.clone();
    let generation = owner.generation.clone();
    let folder = state.downloads.clone();
    blocking(move || {
        crate::sessions::scoped_dispatch(&session, &generation, Some(&ticket), &client, || {
            let library_file = id.starts_with("m3u-file-");
            let route = if library_file { "m3u-files" } else { "m3u" };
            let response = client.request("GET", &format!("/api/me/v1/{route}/{id}"), &[], None)?;
            crate::sessions::with_current(&session, &generation, &ticket, &client, || {
                let path = if library_file {
                    phemios_core::download::publish_library_m3u(&folder, &id, &response)?
                } else {
                    phemios_core::download::publish(&folder, &id, &response)?
                };
                Ok(path.to_string_lossy().into_owned())
            })
        })
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

#[tauri::command]
pub(crate) async fn aede_download_spectrum(
    version: u32,
    reference: String,
    state: State<'_, Aede>,
) -> Result<String, String> {
    bridge(version)?;
    let (origin, reference) = phemios_core::federation::resolve(&reference)?;
    let client = client(state.owner(origin))?;
    let folder = state.downloads.clone();
    blocking(move || {
        let bytes = client.spectrum_download(&reference)?;
        let path = phemios_core::download::publish_spectrum(&folder, &reference, &bytes)?;
        Ok(path.to_string_lossy().into_owned())
    })
    .await
}
