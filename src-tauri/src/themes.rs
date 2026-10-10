//! User-selected theme documents, without a general filesystem bridge.
use super::aede::{blocking, bridge};
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
#[tauri::command]
pub(crate) async fn theme_import(version: u32, app: AppHandle) -> Result<Option<String>, String> {
    bridge(version)?;
    blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .add_filter("Phémios theme", &["json"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = file.into_path().map_err(|_| "Thème invalide.")?;
        if std::fs::metadata(&path)
            .map_err(|_| "Thème illisible.")?
            .len()
            > 4096
        {
            return Err("Thème invalide.".into());
        }
        let mut document = String::new();
        std::fs::File::open(path)
            .map_err(|_| "Thème illisible.")?
            .take(4097)
            .read_to_string(&mut document)
            .map_err(|_| "Thème illisible.")?;
        if document.len() > 4096 {
            return Err("Thème invalide.".into());
        }
        Ok(Some(document))
    })
    .await
}
#[tauri::command]
pub(crate) async fn theme_export(
    version: u32,
    app: AppHandle,
    document: String,
) -> Result<Option<String>, String> {
    bridge(version)?;
    if document.len() > 4096 || serde_json::from_str::<serde_json::Value>(&document).is_err() {
        return Err("Thème invalide.".into());
    }
    blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .add_filter("Phémios theme", &["json"])
            .set_file_name("phemios-theme.json")
            .blocking_save_file()
        else {
            return Ok(None);
        };
        let path = file.into_path().map_err(|_| "Thème invalide.")?;
        write_document(&path, &document)?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
}

// The destination comes only from the native save dialog. Never change its parent's permissions.
fn write_document(path: &Path, document: &str) -> Result<(), String> {
    if document.len() > 4096 || serde_json::from_str::<serde_json::Value>(document).is_err() {
        return Err("Thème invalide.".into());
    }
    static NEXT: AtomicU64 = AtomicU64::new(1);
    let folder = path.parent().ok_or("Thème non enregistré.")?;
    let temporary = folder.join(format!(
        ".phemios-theme-{}-{}.tmp",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|_| "Thème non enregistré.")?;
    let result = (|| {
        file.write_all(document.as_bytes())?;
        file.sync_all()?;
        drop(file);
        std::fs::rename(&temporary, path)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temporary);
    }
    result.map_err(|_: std::io::Error| "Thème non enregistré.".into())
}
#[cfg(test)]
#[path = "themes_tests.rs"]
mod tests;
