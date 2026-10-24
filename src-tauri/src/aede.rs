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
    pub(crate) local_lifecycle: Arc<crate::local_lifecycle::Lifecycle>,
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

/// Read only the existing process session; this neither logs in nor probes the remote server.
#[tauri::command]
pub(crate) fn aede_session(
    version: u32,
    source: Option<String>,
    state: State<'_, Aede>,
) -> Result<Option<Value>, String> {
    bridge(version)?;
    let state = state.owner(self::source(source.as_deref())?);
    crate::sessions::current(&state.session, &state.generation)
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
    let session = state.server.session.clone();
    let current_generation = state.server.generation.clone();
    let (client, account) = blocking(move || {
        let client = match certificate {
            Some(certificate) => Client::login_pinned(&server, &username, &password, &certificate),
            None => Client::login(&server, &username, &password),
        }?;
        let account = crate::sessions::publish_remote_login(
            &session,
            &current_generation,
            generation,
            client.clone(),
            |rejected| {
                rejected
                    .request("DELETE", "/api/auth/v1/session", &[], None)
                    .map(|_| ())
            },
        )?;
        Ok((client, account))
    })
    .await?;
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
    let generation = hq.reserve_cleanup();
    let published = hq.published_epoch.clone();
    let session = crate::sessions::invalidate(&state.server.session, &state.server.generation)?;
    let player = player.inner().clone();
    let controller = hq.controller.clone();
    let routing = hq.routing.clone();
    let source = state.playback_source.clone();
    blocking(move || {
        phemios_core::session_cleanup::complete(
            || {
                crate::playback_routing::retire(&routing, &published, generation, || {
                    if *source.lock().map_err(|_| "État audio indisponible.")?
                        == phemios_core::federation::Source::Server
                    {
                        return phemios_core::session_cleanup::complete(
                            || player.halt(),
                            || controller.halt(),
                        );
                    }
                    Ok(())
                })
            },
            || match session {
                Some(client) => client
                    .request("DELETE", "/api/auth/v1/session", &[], None)
                    .map(|_| ()),
                None => Ok(()),
            },
        )
    })
    .await
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
/// The webview chooses no path or source: this action only removes the disconnected remote cache.
#[tauri::command]
pub(crate) async fn aede_clear_server_cache(
    version: u32,
    state: State<'_, Aede>,
) -> Result<(), String> {
    bridge(version)?;
    let session = state.server.session.clone();
    let retained = state.server.snapshot.clone();
    let cache = state.server.cache.clone();
    let generation = state.server.generation.clone();
    let captured = generation.load(std::sync::atomic::Ordering::SeqCst);
    blocking(move || {
        crate::snapshots::clear(&session, &retained, &cache, || {
            generation.load(std::sync::atomic::Ordering::SeqCst) == captured
        })
    })
    .await
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
                .parental_status_admitted(|| {
                    crate::sessions::dispatch(&session, &client, || Ok(()))
                })?
                .is_some_and(|value| value["policy"]["enabled"] == true)
        {
            let snapshot = retained
                .lock()
                .map_err(|_| "Cache natif indisponible.")?
                .clone();
            return snapshot
                .map(|value| {
                    client.admit_snapshot_admitted(&value, || {
                        crate::sessions::dispatch(&session, &client, || Ok(()))
                    })?;
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
    if origin == phemios_core::federation::Source::Local {
        phemios_core::network::managed_account_request(&method, &path)?;
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
                let current = || {
                    crate::sessions::scoped_dispatch(
                        &session,
                        &generation,
                        expected_session.as_deref(),
                        &client,
                        || Ok(()),
                    )
                };
                if method == "POST" && path == "/api/admin/v1/fetch" {
                    if client.account()["account"]["role"] != "admin" {
                        return Err("Un administrateur Aède est nécessaire.".into());
                    }
                    let keys = engine
                        .lock()
                        .map_err(|_| "Moteur local occupé.")?
                        .fetch_keys()?;
                    let status = if keys.as_object().is_some_and(|rows| !rows.is_empty()) {
                        client.request_admitted("GET", "/api/v1/status", &[], None, current)?
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
                            client.request_admitted(
                                &method,
                                &path,
                                &query,
                                body.as_ref(),
                                current,
                            )?,
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
            let current =
                || crate::sessions::with_generation(&sessions, &generation, ticket, || Ok(()));
            if let Some(client) = &session {
                crate::snapshots::admit_artwork(client, &snapshot, &reference, current)?;
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
            let bytes = client.artwork_admitted(&reference, &kind, current)?;
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
            let current =
                || crate::sessions::with_generation(&sessions, &generation, ticket, || Ok(()));
            if let Some(client) = &session {
                crate::snapshots::admit_artwork(client, &snapshot, &artist, current)?;
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
            let response = client.request_admitted(
                "GET",
                &format!("/api/me/v1/{route}/{id}"),
                &[],
                None,
                || {
                    crate::sessions::with_current(
                        &session,
                        &generation,
                        &ticket,
                        &client,
                        || Ok(()),
                    )
                },
            )?;
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
    let session = state.owner(origin).session.clone();
    let folder = state.downloads.clone();
    blocking(move || {
        let response = client.request_admitted(
            "GET",
            "/api/v1/analysis/report",
            &[("ref", reference.as_str())],
            None,
            || crate::sessions::dispatch(&session, &client, || Ok(())),
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
    let session = state.owner(origin).session.clone();
    let folder = state.downloads.clone();
    blocking(move || {
        let bytes = client.spectrum_download_admitted(&reference, || {
            crate::sessions::dispatch(&session, &client, || Ok(()))
        })?;
        let path = phemios_core::download::publish_spectrum(&folder, &reference, &bytes)?;
        Ok(path.to_string_lossy().into_owned())
    })
    .await
}
