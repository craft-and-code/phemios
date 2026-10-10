//! Public RSS commands never carry an Aède session or expose arbitrary filesystem access.
use std::sync::{Arc, Mutex};
use tauri::State;
pub(crate) struct Podcasts {
    pub(crate) feeds: Arc<Mutex<phemios_core::podcast::FeedClient>>,
    pub(crate) download: Arc<Mutex<()>>,
}
#[tauri::command]
pub(crate) async fn podcast_feed(
    version: u32,
    url: String,
    state: State<'_, Podcasts>,
) -> Result<String, String> {
    crate::aede::bridge(version)?;
    let client = state.feeds.clone();
    crate::aede::blocking(move || {
        let client = client
            .try_lock()
            .map_err(|_| "Une demande podcast est déjà en cours. Réessayez.")?;
        client.read(&url)
    })
    .await
}

/// Save one explicit public media URL to a confined native-owned folder.
#[tauri::command]
pub(crate) async fn podcast_download(
    version: u32,
    url: String,
    title: String,
    state: State<'_, crate::aede::Aede>,
    podcasts: State<'_, Podcasts>,
) -> Result<String, String> {
    crate::aede::bridge(version)?;
    let folder = state.downloads.join("Podcasts");
    let gate = podcasts.download.clone();
    crate::aede::blocking(move || {
        let _guard = gate
            .try_lock()
            .map_err(|_| "Un téléchargement podcast est déjà en cours.")?;
        let file = phemios_core::podcast_download::download_episode(&folder, &url, &title)?;
        Ok(file.to_string_lossy().into_owned())
    })
    .await
}
