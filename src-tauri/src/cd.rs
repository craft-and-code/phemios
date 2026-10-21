//! Versioned optical operations accept only native-discovered tokens, never source paths.
use crate::aede::{Aede, blocking, bridge};
use crate::cd_accounts::admit;
use phemios_core::playback::Player;
use serde_json::{Value, json};
use std::sync::{Arc, Mutex, atomic::Ordering};
use tauri::State;
#[derive(Default)]
pub(crate) struct Cd(pub(crate) Arc<Mutex<phemios_cd::Library>>);
fn snapshot(library: &phemios_cd::Library) -> Value {
    json!({"drives":library.snapshot().iter().map(|d| json!({"id":d.id,"name":d.name,"image":d.image,"error":d.error,"disc":d.disc.as_ref().map(|disc|json!({"token":disc.token,"title":disc.title(),"artist":disc.performer(),"tracks":disc.tracks.iter().map(|t|json!({"reference":disc.reference(t.number),"number":t.number,"duration_ms":t.duration_ms(),"title":disc.track_names(t.number).0,"artist":disc.track_names(t.number).1})).collect::<Vec<_>>()}))})).collect::<Vec<_>>()})
}
#[tauri::command]
pub(crate) async fn cd_scan(
    version: u32,
    id: Option<String>,
    cd: State<'_, Cd>,
    player: State<'_, Arc<Player>>,
) -> Result<Value, String> {
    bridge(version)?;
    let cd = cd.0.clone();
    let player = player.inner().clone();
    blocking(move || {
        let mut library = cd.lock().map_err(|_| "Lecteurs CD indisponibles.")?;
        let state = player.snapshot()?;
        // Do not probe the same physical device while its dedicated reader owns it.
        let reading = state["source"] == "cd"
            && matches!(
                state["status"].as_str(),
                Some("playing" | "paused" | "connecting")
            );
        if !reading
            && !id
                .as_deref()
                .map(|id| library.refresh_image(id))
                .transpose()?
                .unwrap_or(false)
        {
            library.scan()?;
        }
        Ok(snapshot(&library))
    })
    .await
}
#[tauri::command]
#[expect(
    clippy::too_many_arguments,
    reason = "Flat versioned CD selection with the existing audio States."
)]
pub(crate) async fn cd_start(
    version: u32,
    token: String,
    tracks: Vec<String>,
    device: String,
    index: usize,
    cd: State<'_, Cd>,
    player: State<'_, Arc<Player>>,
    state: State<'_, Aede>,
    hq: State<'_, crate::hqplayer::HqPlayer>,
) -> Result<(), String> {
    bridge(version)?;
    let stamps = crate::cd_accounts::capture([
        (state.local.session.clone(), state.local.generation.clone()),
        (
            state.server.session.clone(),
            state.server.generation.clone(),
        ),
    ])?;
    let permission = crate::cd_accounts::permission(stamps.clone());
    let cd = cd.0.clone();
    let player = player.inner().clone();
    let controller = hq.controller.clone();
    let routing = hq.routing.clone();
    let epoch = hq.epoch.clone();
    let published = hq.published_epoch.clone();
    let generation = epoch.fetch_add(1, Ordering::SeqCst) + 1;
    blocking(move || {
        let disc = cd
            .lock()
            .map_err(|_| "Lecteurs CD indisponibles.")?
            .disc(&token)?;
        // Resolve every requested occurrence before stopping any existing source.
        if tracks.is_empty()
            || tracks.len() > 4096
            || index >= tracks.len()
            || device == phemios_core::hqplayer::OUTPUT
            || device.len() > 2048
        {
            return Err("Sélection CD ou sortie audio invalide.".into());
        }
        for reference in &tracks {
            disc.track(reference)?;
        }
        permission()?;
        let _guard = routing.lock().map_err(|_| "État audio indisponible.")?;
        crate::playback_routing::replace(
            &published,
            generation,
            || {
                admit(&stamps, || {
                    if epoch.load(Ordering::SeqCst) == generation {
                        Ok(())
                    } else {
                        Err("Lecture CD annulée.".into())
                    }
                })
            },
            || {
                player.halt()?;
                controller.halt()
            },
            || {
                admit(&stamps, || {
                    player.start_cd(disc, tracks, device, index, Some(permission))
                })
            },
        )
    })
    .await
}
// A queued Play may win the UI race; enforce the ejection boundary under native routing too.
fn require_eject_idle(current: &Value, token: Option<&str>) -> Result<(), String> {
    if current["source"] == "cd"
        && token.is_some_and(|token| current["cd_disc"] == token)
        && matches!(current["status"].as_str(), Some("playing" | "connecting"))
    {
        return Err("Arrêtez la lecture du CD avant de l’éjecter.".into());
    }
    Ok(())
}
#[tauri::command]
pub(crate) async fn cd_eject(
    version: u32,
    id: String,
    cd: State<'_, Cd>,
    player: State<'_, Arc<Player>>,
    hq: State<'_, crate::hqplayer::HqPlayer>,
) -> Result<Value, String> {
    bridge(version)?;
    let cd = cd.0.clone();
    let player = player.inner().clone();
    let routing = hq.routing.clone();
    let epoch = hq.epoch.clone();
    blocking(move || {
        let _guard = routing.lock().map_err(|_| "État audio indisponible.")?;
        let mut library = cd.lock().map_err(|_| "Lecteurs CD indisponibles.")?;
        if !library.snapshot().iter().any(|d| d.id == id) {
            return Err("Lecteur CD inconnu.".into());
        }
        let disc_token = library
            .snapshot()
            .iter()
            .find(|drive| drive.id == id)
            .and_then(|drive| drive.disc.as_ref())
            .map(|disc| disc.token.as_str());
        let current = player.snapshot()?;
        require_eject_idle(&current, disc_token)?;
        epoch.fetch_add(1, Ordering::SeqCst);
        let owns_disc = current["source"] == "cd"
            && disc_token.is_some_and(|token| current["cd_disc"] == token);
        if owns_disc {
            player.halt()?;
        }
        library.eject(&id)?;
        if owns_disc {
            player.clear()?;
        }
        Ok(snapshot(&library))
    })
    .await
}

#[cfg(test)]
#[path = "cd_tests.rs"]
mod tests;
