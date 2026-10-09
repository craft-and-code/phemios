//! Desktop wiring; domain rules belong to Aède, client policies to phemios-core.
#![warn(missing_docs)]
mod aede;
mod commands;
mod local;
mod playback;
mod radio;
mod volumes;
use tauri::Manager;

/// Start the local desktop window with its minimal capability set.
pub fn run() -> Result<(), tauri::Error> {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let root = app.path().app_data_dir()?.join("cache");
            let source = |path| aede::SourceState {
                session: std::sync::Mutex::new(None),
                snapshot: std::sync::Mutex::new(None),
                cache: phemios_core::cache::Cache::new(path),
            };
            let executable = std::env::current_exe()?
                .parent()
                .ok_or("Application executable has no parent")?
                .join(if cfg!(windows) {
                    "phemios-aede.exe"
                } else {
                    "phemios-aede"
                });
            app.manage(aede::Aede {
                server: source(root.clone()),
                local: source(root.join("local")),
                engine: std::sync::Arc::new(std::sync::Mutex::new(
                    phemios_core::local::Engine::new(
                        app.path().app_data_dir()?.join("local-engine"),
                        executable,
                    ),
                )),
                playback_source: std::sync::Mutex::new(phemios_core::federation::Source::Server),
                downloads: app.path().download_dir()?.join("Phémios"),
            });
            app.manage(std::sync::Arc::new(
                phemios_core::playback::Player::default(),
            ));
            app.manage(radio::Radio(std::sync::Arc::new(std::sync::Mutex::new(
                phemios_core::radio::Directory::default(),
            ))));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::runtime_info,
            volumes::players_discover,
            local::local_status,
            local::local_start,
            local::local_stop,
            local::local_pick_roots,
            local::local_scan,
            local::local_root_action,
            local::local_keys,
            radio::radio_search,
            radio::radio_statistics,
            radio::radio_resolve,
            playback::playback_devices,
            playback::playback_state,
            playback::playback_start,
            playback::playback_control,
            aede::aede_login,
            aede::aede_logout,
            aede::aede_sync,
            aede::aede_cache,
            aede::aede_request,
            aede::aede_artwork,
            aede::aede_missing_cover,
            aede::aede_download,
            aede::aede_download_analysis,
            aede::aede_download_spectrum
        ])
        .run(tauri::generate_context!())
}
