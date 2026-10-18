//! Explicit local CUE dialog. No path, filesystem permission or image mount is exposed to the WebView.
use crate::{
    aede::{blocking, bridge},
    cd::Cd,
};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
#[tauri::command]
pub(crate) async fn cd_open_image(
    version: u32,
    app: AppHandle,
    cd: State<'_, Cd>,
) -> Result<Option<String>, String> {
    bridge(version)?;
    let cd = cd.0.clone();
    blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .add_filter("Images CUE (BIN, FLAC, WAV, APE)", &["cue"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = file.into_path().map_err(|_| "Fichier CUE invalide.")?;
        cd.lock()
            .map_err(|_| "Lecteurs CD indisponibles.")?
            .open_image(&path)
            .map(Some)
    })
    .await
}
