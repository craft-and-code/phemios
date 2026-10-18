//! Native file admission for public Aède desktop identities; no private credential import.
use std::io::Read;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
#[tauri::command]
pub(crate) async fn aede_import_profile(
    version: u32,
    app: AppHandle,
) -> Result<Option<serde_json::Value>, String> {
    crate::aede::bridge(version)?;
    crate::aede::blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .add_filter("Connexion Aède", &["json"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = file
            .into_path()
            .map_err(|_| "Fichier de connexion invalide.")?;
        let meta =
            std::fs::symlink_metadata(&path).map_err(|_| "Profil de connexion illisible.")?;
        if !meta.is_file() || meta.len() > 32768 {
            return Err("Profil de connexion invalide ou trop volumineux.".into());
        }
        let mut text = String::new();
        std::fs::File::open(path)
            .and_then(|file| file.take(32769).read_to_string(&mut text))
            .map_err(|_| "Profil de connexion illisible.")?;
        phemios_core::server_profile::parse(&text).map(Some)
    })
    .await
}
