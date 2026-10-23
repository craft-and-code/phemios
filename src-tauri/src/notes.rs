//! Narrow owner-scoped personal note export; no UI document, path or filename is trusted.
use crate::aede::{Aede, blocking, bridge, client};
use tauri::{Manager, State};
#[tauri::command]
pub(crate) async fn note_export(
    version: u32,
    app: tauri::AppHandle,
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
    let folder = app
        .path()
        .download_dir()
        .map_err(|_| "Dossier de téléchargement inaccessible.")?;
    blocking(move || {
        crate::sessions::scoped_dispatch(&held, &generation, Some(&ticket), &client, || {
            let current =
                || crate::sessions::with_current(&held, &generation, &ticket, &client, || Ok(()));
            let response = client.request_admitted(
                "GET",
                "/api/me/v1/annotation",
                &[("ref", &reference)],
                None,
                current,
            )?;
            let endpoint = if reference.starts_with("artist:") {
                "/api/v1/artist"
            } else if reference.starts_with("release:") {
                "/api/v1/album"
            } else {
                "/api/v1/track"
            };
            let detail =
                client.request_admitted("GET", endpoint, &[("ref", &reference)], None, current)?;
            crate::sessions::with_current(&held, &generation, &ticket, &client, || {
                let saved =
                    phemios_core::download::publish_note(&folder, &reference, &response, &detail)?;
                Ok(saved.to_string_lossy().into_owned())
            })
        })
    })
    .await
}
