//! Explicit public Wikipedia operations; no Aède session or arbitrary URL is involved.
use std::sync::{Arc, Mutex};
use tauri::State;
#[derive(Default)]
pub(crate) struct Encyclopedia(pub(crate) Arc<Mutex<phemios_core::encyclopedia::Client>>);
#[tauri::command]
pub(crate) async fn encyclopedia_search(
    version: u32,
    language: String,
    query: String,
    state: State<'_, Encyclopedia>,
) -> Result<serde_json::Value, String> {
    crate::aede::bridge(version)?;
    let client = state.0.clone();
    crate::aede::blocking(move || {
        let client = client
            .try_lock()
            .map_err(|_| "Une demande Wikipédia est déjà en cours. Réessayez.")?;
        client.search(&language, &query)
    })
    .await
}
#[tauri::command]
pub(crate) async fn encyclopedia_article(
    version: u32,
    language: String,
    page_id: u64,
    state: State<'_, Encyclopedia>,
) -> Result<serde_json::Value, String> {
    crate::aede::bridge(version)?;
    let client = state.0.clone();
    crate::aede::blocking(move || {
        let client = client
            .try_lock()
            .map_err(|_| "Une demande Wikipédia est déjà en cours. Réessayez.")?;
        client.article(&language, page_id)
    })
    .await
}

#[tauri::command]
pub(crate) async fn encyclopedia_translate(
    version: u32,
    language: String,
    page_id: u64,
    target: String,
    state: State<'_, Encyclopedia>,
) -> Result<serde_json::Value, String> {
    crate::aede::bridge(version)?;
    let client = state.0.clone();
    crate::aede::blocking(move || {
        let client = client
            .try_lock()
            .map_err(|_| "Une demande Wikipédia est déjà en cours. Réessayez.")?;
        client.translated_article(&language, page_id, &target)
    })
    .await
}

#[tauri::command]
pub(crate) async fn encyclopedia_export(
    version: u32,
    app: tauri::AppHandle,
    language: String,
    page_id: u64,
    document: String,
) -> Result<String, String> {
    use tauri::Manager;
    crate::aede::bridge(version)?;
    let folder = app
        .path()
        .download_dir()
        .map_err(|_| "Dossier de téléchargement inaccessible.")?
        .join("Phémios")
        .join("Encyclopédie");
    crate::aede::blocking(move || {
        let path =
            phemios_core::download::publish_wikipedia(&folder, &language, page_id, &document)?;
        Ok(path.to_string_lossy().into_owned())
    })
    .await
}
