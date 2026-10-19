//! Explicit read-only JSON admission. Imported audio paths are never followed or sent to Aède.
use crate::aede::{blocking, bridge};
use std::io::Read;
use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
const LIMIT: u64 = 16 * 1024 * 1024;
#[tauri::command]
pub(crate) async fn analysis_import(
    version: u32,
    app: AppHandle,
) -> Result<Option<String>, String> {
    bridge(version)?;
    blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .add_filter("FlacCompagnon JSON", &["json"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = file
            .into_path()
            .map_err(|_| "Rapport FlacCompagnon illisible.")?;
        read_document(&path).map(Some)
    })
    .await
}
fn read_document(path: &Path) -> Result<String, String> {
    let metadata =
        std::fs::symlink_metadata(path).map_err(|_| "Rapport FlacCompagnon illisible.")?;
    if !metadata.is_file() || metadata.len() > LIMIT {
        return Err("Rapport invalide ou trop volumineux (16 Mio maximum).".into());
    }
    let file = std::fs::File::open(path).map_err(|_| "Rapport FlacCompagnon illisible.")?;
    if !file
        .metadata()
        .map_err(|_| "Rapport FlacCompagnon illisible.")?
        .is_file()
    {
        return Err("Rapport FlacCompagnon illisible.".into());
    }
    let mut text = String::new();
    file.take(LIMIT + 1)
        .read_to_string(&mut text)
        .map_err(|_| "Rapport FlacCompagnon illisible.")?;
    if text.len() as u64 > LIMIT {
        return Err("Rapport invalide ou trop volumineux (16 Mio maximum).".into());
    }
    Ok(text)
}
#[cfg(test)]
#[path = "analysis_import_tests.rs"]
mod tests;
