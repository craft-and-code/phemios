//! Public RSS commands never carry an Aède session or expose arbitrary filesystem access.
use std::sync::{Arc, Mutex};
use tauri::State;
pub(crate) struct Podcasts(pub(crate) Arc<Mutex<phemios_core::podcast::FeedClient>>);
#[tauri::command]
pub(crate) async fn podcast_feed(
    version: u32,
    url: String,
    state: State<'_, Podcasts>,
) -> Result<String, String> {
    crate::aede::bridge(version)?;
    let client = state.0.clone();
    crate::aede::blocking(move || {
        let client = client
            .try_lock()
            .map_err(|_| "Une demande podcast est déjà en cours. Réessayez.")?;
        client.read(&url)
    })
    .await
}
