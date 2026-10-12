//! Narrow owner-scoped personal note export; no UI document, path or filename is trusted.
use crate::aede::{Aede, blocking, bridge, client};
use tauri::State;
#[tauri::command]
pub(crate) async fn note_export(
    version: u32,
    reference: String,
    expected_session: Option<String>,
    state: State<'_, Aede>,
) -> Result<String, String> {
    bridge(version)?;
    let ticket = expected_session.ok_or("Session invalide.")?;
    let (source, reference) = phemios_core::federation::resolve(&reference)?;
    let owner = state.owner(source);
    let client = client(owner)?;
    let held = owner.session.clone();
    let generation = owner.generation.clone();
    let folder = state.downloads.clone();
    blocking(move || {
        crate::sessions::scoped_dispatch(&held, &generation, Some(&ticket), &client, || {
            let response =
                client.request("GET", "/api/me/v1/annotation", &[("ref", &reference)], None)?;
            crate::sessions::with_current(&held, &generation, &ticket, &client, || {
                let saved = phemios_core::download::publish_note(&folder, &reference, &response)?;
                Ok(saved.to_string_lossy().into_owned())
            })
        })
    })
    .await
}
