//! Desktop wiring; domain rules belong to Aède, client policies to phemios-core.
#![warn(missing_docs)]
mod aede;
mod commands;
use tauri::Manager;

/// Start the local desktop window with its minimal capability set.
pub fn run() -> Result<(), tauri::Error> {
    tauri::Builder::default()
        .setup(|app| {
            let root = app.path().app_data_dir()?.join("cache");
            app.manage(aede::Aede {
                session: std::sync::Mutex::new(None),
                downloads: app.path().download_dir()?.join("Phémios"),
                snapshot: std::sync::Mutex::new(None),
                cache: phemios_core::cache::Cache::new(root),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::runtime_info,
            aede::aede_login,
            aede::aede_logout,
            aede::aede_sync,
            aede::aede_cache,
            aede::aede_request,
            aede::aede_artwork,
            aede::aede_download
        ])
        .run(tauri::generate_context!())
}
