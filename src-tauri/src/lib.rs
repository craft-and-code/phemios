//! Desktop wiring; domain rules belong to Aède, client policies to phemios-core.
#![warn(missing_docs)]
#[cfg(test)]
mod account_test_support;
mod aede;
mod articles;
mod cd;
mod cd_image;
mod commands;
mod concerts;
mod encyclopedia;
mod exports;
mod hqplayer;
mod local;
mod notes;
mod personal_backup;
mod playback;
mod podcast;
mod radio;
mod server_profile;
mod sessions;
mod snapshots;
mod themes;
mod transfer;
mod transfer_folder;
mod volumes;
use tauri::Manager;

/// Start the local desktop window with its minimal capability set.
pub fn run() -> Result<(), tauri::Error> {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let root = app.path().app_data_dir()?.join("cache");
            let source = |path| aede::SourceState {
                session: std::sync::Arc::new(std::sync::Mutex::new(None)),
                generation: std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0)),
                snapshot: std::sync::Arc::new(std::sync::Mutex::new(None)),
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
                playback_source: std::sync::Arc::new(std::sync::Mutex::new(
                    phemios_core::federation::Source::Server,
                )),
                articles: std::sync::Arc::new(std::sync::Mutex::new(
                    phemios_core::article_store::Store::new(
                        app.path().app_data_dir()?.join("private-articles"),
                    ),
                )),
                podcasts: std::sync::Arc::new(std::sync::Mutex::new(
                    phemios_core::podcast_store::Store::new(
                        app.path().app_data_dir()?.join("private-podcasts"),
                    ),
                )),
                downloads: app.path().download_dir()?.join("Phémios"),
            });
            app.manage(std::sync::Arc::new(
                phemios_core::playback::Player::default(),
            ));
            app.manage(hqplayer::HqPlayer::default());
            app.manage(cd::Cd::default());
            app.manage(std::sync::Arc::new(transfer::Transfers::default()));
            app.manage(encyclopedia::Encyclopedia::new(
                app.path().app_data_dir()?.join("public-biographies"),
            ));
            app.manage(concerts::Concerts::default());
            app.manage(radio::Radio(std::sync::Arc::new(std::sync::Mutex::new(
                phemios_core::radio::Directory::default(),
            ))));
            app.manage(podcast::Podcasts {
                feeds: std::sync::Arc::new(std::sync::Mutex::new(
                    phemios_core::podcast::FeedClient::default(),
                )),
                download: std::sync::Arc::new(std::sync::Mutex::new(())),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::runtime_info,
            cd::cd_scan,
            cd_image::cd_open_image,
            cd::cd_start,
            cd::cd_eject,
            server_profile::aede_import_profile,
            concerts::concerts_config,
            concerts::concerts_events,
            commands::external_open,
            encyclopedia::encyclopedia_search,
            encyclopedia::encyclopedia_article,
            encyclopedia::encyclopedia_title,
            encyclopedia::biography_cached,
            encyclopedia::encyclopedia_translate,
            encyclopedia::encyclopedia_export,
            hqplayer::hqplayer_connect,
            hqplayer::hqplayer_disconnect,
            notes::note_export,
            personal_backup::personal_backup_read,
            personal_backup::personal_backup_restore,
            exports::statistics_export,
            exports::preferences_import,
            exports::preferences_export,
            themes::theme_import,
            themes::theme_export,
            transfer_folder::transfer_pick_folder,
            volumes::players_discover,
            volumes::players_eject,
            transfer::transfer_prepare,
            transfer::transfer_start,
            transfer::transfer_status,
            transfer::transfer_cancel,
            local::local_status,
            local::local_start,
            local::local_stop,
            local::local_pick_roots,
            local::local_scan,
            local::local_root_action,
            local::local_keys,
            podcast::podcast_feed,
            podcast::podcast_download,
            podcast::podcast_state,
            podcast::podcast_update,
            articles::article_state,
            articles::article_update,
            radio::radio_search,
            radio::radio_statistics,
            radio::radio_resolve,
            playback::playback_devices,
            playback::playback_state,
            playback::playback_start,
            playback::playback_append,
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
