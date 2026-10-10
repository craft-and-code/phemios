//! Bounded statistics export through the native save dialog only.
use crate::aede::{blocking, bridge};
use std::{
    io::Write,
    path::Path,
    sync::atomic::{AtomicU64, Ordering},
};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
#[tauri::command]
pub(crate) async fn statistics_export(
    version: u32,
    app: AppHandle,
    document: String,
) -> Result<Option<String>, String> {
    bridge(version)?;
    if document.len() > 4 * 1024 * 1024
        || !document.starts_with("\u{feff}\"section\";\"measure\";\"value\";\"unit\"\r\n")
        || document.contains('\0')
    {
        return Err("CSV invalide ou trop volumineux.".into());
    }
    blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .add_filter("CSV", &["csv"])
            .set_file_name("phemios-statistics.csv")
            .blocking_save_file()
        else {
            return Ok(None);
        };
        let path = file.into_path().map_err(|_| "Destination CSV invalide.")?;
        write_csv(&path, &document)?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
}
fn write_csv(path: &Path, document: &str) -> Result<(), String> {
    static NEXT: AtomicU64 = AtomicU64::new(1);
    let folder = path.parent().ok_or("CSV non enregistré.")?;
    let temporary = folder.join(format!(
        ".phemios-csv-{}-{}.tmp",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|_| "CSV non enregistré.")?;
    let result = (|| {
        file.write_all(document.as_bytes())?;
        file.sync_all()?;
        drop(file);
        std::fs::rename(&temporary, path)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temporary);
    }
    result.map_err(|_: std::io::Error| "CSV non enregistré.".into())
}

#[cfg(test)]
#[path = "exports_tests.rs"]
mod tests;
