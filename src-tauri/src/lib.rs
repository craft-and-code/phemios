//! Desktop wiring; domain rules belong to Aède, client policies to phemios-core.
#![warn(missing_docs)]
mod commands;

/// Start the local desktop window with its minimal capability set.
pub fn run() -> Result<(), tauri::Error> {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::runtime_info])
        .run(tauri::generate_context!())
}
