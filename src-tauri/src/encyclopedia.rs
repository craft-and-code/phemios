//! Explicit public Wikipedia operations; no Aède session or arbitrary URL is involved.
use std::sync::{Arc, Mutex};
use tauri::State;
pub(crate) struct Encyclopedia(
    pub(crate) Arc<Mutex<phemios_core::encyclopedia::Client>>,
    pub(crate) Arc<Mutex<phemios_core::encyclopedia::biography_cache::Store>>,
);
impl Encyclopedia {
    pub(crate) fn new(root: std::path::PathBuf) -> Self {
        Self(
            Arc::default(),
            Arc::new(Mutex::new(
                phemios_core::encyclopedia::biography_cache::Store::new(root),
            )),
        )
    }
}
/// Cached biography lookup never initiates public HTTP and accepts no filesystem path.
#[tauri::command]
pub(crate) async fn biography_cached(
    version: u32,
    language: String,
    title: String,
    state: State<'_, Encyclopedia>,
) -> Result<Option<serde_json::Value>, String> {
    crate::aede::bridge(version)?;
    let store = state.1.clone();
    crate::aede::blocking(move || {
        store
            .try_lock()
            .map_err(|_| "Cache des biographies occupé.")?
            .get(&language, &title)
    })
    .await
}
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
        .map_err(|_| "Dossier de téléchargement inaccessible.")?;
    crate::aede::blocking(move || {
        let path =
            phemios_core::download::publish_wikipedia(&folder, &language, page_id, &document)?;
        Ok(path.to_string_lossy().into_owned())
    })
    .await
}

/// Resolve an explicitly selected biography title through the same bounded public client.
#[tauri::command]
pub(crate) async fn encyclopedia_title(
    version: u32,
    language: String,
    title: String,
    state: State<'_, Encyclopedia>,
) -> Result<serde_json::Value, String> {
    crate::aede::bridge(version)?;
    let client = state.0.clone();
    let store = state.1.clone();
    crate::aede::blocking(move || {
        let client = client
            .try_lock()
            .map_err(|_| "Une demande Wikipédia est déjà en cours. Réessayez.")?;
        let store = store
            .try_lock()
            .map_err(|_| "Cache des biographies occupé.")?
            .clone();
        client.retained_biography(&store, &language, &title)
    })
    .await
}
