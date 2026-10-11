//! Bounded statistics and interface-preference files through native dialogs only.
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
        write_document(&path, &document)?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
}
fn write_document(path: &Path, document: &str) -> Result<(), String> {
    static NEXT: AtomicU64 = AtomicU64::new(1);
    let folder = path.parent().ok_or("Fichier non enregistré.")?;
    let temporary = folder.join(format!(
        ".phemios-csv-{}-{}.tmp",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|_| "Fichier non enregistré.")?;
    let result = (|| {
        file.write_all(document.as_bytes())?;
        file.sync_all()?;
        drop(file);
        std::fs::rename(&temporary, path)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temporary);
    }
    result.map_err(|_: std::io::Error| "Fichier non enregistré.".into())
}

#[cfg(test)]
#[path = "exports_tests.rs"]
mod tests;

const PREFERENCE_LIMIT: usize = 128 * 1024;
const PREFERENCE_KEYS: [&str; 9] = [
    "phemios.appearance",
    "phemios.navigation.v1",
    "phemios.tools.v1",
    "phemios.duration",
    "phemios.visualizer",
    "phemios.spectrum",
    "phemios.spectrum-style",
    "phemios.shortcuts.v1",
    "phemios.audio.v1",
];
// File transport validates the envelope; TypeScript applies every existing semantic preference parser before admission.
fn validate_preferences(document: &str) -> Result<(), String> {
    if document.len() > PREFERENCE_LIMIT || document.contains('\0') {
        return Err("Sauvegarde des préférences invalide.".into());
    }
    let parsed: serde_json::Value =
        serde_json::from_str(document).map_err(|_| "Sauvegarde des préférences invalide.")?;
    let root = parsed
        .as_object()
        .ok_or("Sauvegarde des préférences invalide.")?;
    let values = parsed["values"]
        .as_object()
        .ok_or("Sauvegarde des préférences invalide.")?;
    if parsed["format"] != "phemios-preferences"
        || parsed["version"] != 1
        || root.len() != 3
        || values.len() != PREFERENCE_KEYS.len()
        || values
            .keys()
            .any(|key| !PREFERENCE_KEYS.contains(&key.as_str()))
    {
        return Err("Sauvegarde des préférences invalide.".into());
    }
    Ok(())
}
#[tauri::command]
pub(crate) async fn preferences_import(
    version: u32,
    app: AppHandle,
) -> Result<Option<String>, String> {
    use std::io::Read;
    bridge(version)?;
    blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .add_filter("Phémios preferences", &["json"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = file
            .into_path()
            .map_err(|_| "Sauvegarde des préférences invalide.")?;
        let mut document = String::new();
        std::fs::File::open(path)
            .map_err(|_| "Sauvegarde des préférences illisible.")?
            .take((PREFERENCE_LIMIT + 1) as u64)
            .read_to_string(&mut document)
            .map_err(|_| "Sauvegarde des préférences illisible.")?;
        validate_preferences(&document)?;
        Ok(Some(document))
    })
    .await
}
#[tauri::command]
pub(crate) async fn preferences_export(
    version: u32,
    app: AppHandle,
    document: String,
) -> Result<Option<String>, String> {
    bridge(version)?;
    validate_preferences(&document)?;
    blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .add_filter("Phémios preferences", &["json"])
            .set_file_name("phemios-preferences.json")
            .blocking_save_file()
        else {
            return Ok(None);
        };
        let path = file
            .into_path()
            .map_err(|_| "Destination des préférences invalide.")?;
        write_document(&path, &document)?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
}
