//! Only the native folder dialog can grant an additional transfer destination; no path argument crosses IPC.
use crate::{
    aede::{blocking, bridge},
    transfer::{Target, Transfers},
};
use phemios_transfer::Mounted;
use serde_json::{Value, json};
use std::{
    path::PathBuf,
    sync::{Arc, atomic::Ordering},
};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
#[tauri::command]
pub(crate) async fn transfer_pick_folder(
    version: u32,
    app: AppHandle,
    transfer: State<'_, Arc<Transfers>>,
) -> Result<Option<Value>, String> {
    bridge(version)?;
    let transfer = transfer.inner().clone();
    blocking(move || {
        pick(&transfer, || {
            app.dialog()
                .file()
                .set_title("Choisir le dossier de destination")
                .blocking_pick_folder()
                .map(|file| {
                    file.into_path()
                        .map_err(|_| "Dossier natif invalide.".into())
                })
                .transpose()
        })
    })
    .await
}
/// Forget only a registered manual folder; this neither deletes files nor ejects a disk.
#[tauri::command]
pub(crate) async fn transfer_forget_folder(
    version: u32,
    id: String,
    transfer: State<'_, Arc<Transfers>>,
) -> Result<(), String> {
    bridge(version)?;
    let transfer = transfer.inner().clone();
    blocking(move || forget(&transfer, &id)).await
}
fn forget(transfer: &Transfers, id: &str) -> Result<(), String> {
    let _destinations = transfer.idle_destinations()?;
    let mut inventory = transfer
        .inventory
        .lock()
        .map_err(|_| "Lecteurs indisponibles.")?;
    let rows = inventory["volumes"]
        .as_array_mut()
        .ok_or("Dossier de destination indisponible.")?;
    let index = rows
        .iter()
        .position(|row| row["id"] == id && row["kind"] == "folder")
        .ok_or("Dossier de destination indisponible.")?;
    let mut targets = transfer.targets.lock().map_err(|_| "Lecteurs occupés.")?;
    let mut folder = transfer
        .folder
        .lock()
        .map_err(|_| "Dossier de destination occupé.")?;
    transfer.retire_preview()?;
    targets.retain(|(registered, _)| registered != id);
    *folder = None;
    rows.remove(index);
    Ok(())
}
fn project(mount: &Mounted, id: &str) -> Value {
    let path = mount.path().to_string_lossy();
    let name = mount
        .path()
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(&path);
    json!({"id":id,"adapter":"mounted","available":true,"name":name,"path":path,"format":"","kind":"folder","icon":"folder","ejectable":false})
}
fn same_folder(target: &Target, mount: &Mounted) -> bool {
    matches!(target, Target::Mounted(candidate) if candidate.confirm().is_ok()
        && candidate.path().canonicalize().is_ok_and(|path| path == mount.path()))
}
fn pick(
    transfer: &Transfers,
    dialog: impl FnOnce() -> Result<Option<PathBuf>, String>,
) -> Result<Option<Value>, String> {
    let _destinations = transfer.idle_destinations()?;
    let Some(path) = dialog()? else {
        return Ok(None);
    };
    let mount = Mounted::capture_folder(path)?;
    let mut inventory = transfer
        .inventory
        .lock()
        .map_err(|_| "Lecteurs indisponibles.")?;
    let mut rows = inventory["volumes"].as_array().cloned().unwrap_or_default();
    let retired: Vec<_> = rows
        .iter()
        .filter(|r| r["kind"] == "folder")
        .filter_map(|r| r["id"].as_str().map(str::to_owned))
        .collect();
    rows.retain(|row| row["kind"] != "folder");
    let existing_id = transfer
        .targets
        .lock()
        .map_err(|_| "Lecteurs occupés.")?
        .iter()
        .find(|(_, target)| same_folder(target, &mount))
        .map(|(id, _)| id.clone());
    let existing = rows
        .iter()
        .find(|row| row["id"].as_str() == existing_id.as_deref())
        .cloned();
    if existing.is_none() && rows.len() >= 256 {
        return Err("Trop de destinations détectées.".into());
    }
    let mut targets = transfer.targets.lock().map_err(|_| "Lecteurs occupés.")?;
    let mut folder = transfer
        .folder
        .lock()
        .map_err(|_| "Dossier de destination occupé.")?;
    transfer.retire_preview()?;
    targets.retain(|(id, _)| !retired.contains(id));
    let row = if let Some(row) = existing {
        row
    } else {
        let id = format!("mount:{}", transfer.serial.fetch_add(1, Ordering::Relaxed));
        let row = project(&mount, &id);
        targets.push((id, Target::Mounted(mount.clone())));
        rows.push(row.clone());
        row
    };
    *folder = Some(mount);
    let warning = inventory["warning"].as_str().unwrap_or("").to_owned();
    *inventory = json!({"volumes":rows,"warning":warning});
    Ok(Some(row))
}
/// Called under destination admission; retain only the current, still-identical explicitly selected folder.
pub(crate) fn retain(
    transfer: &Transfers,
    rows: &mut Vec<Value>,
    targets: &mut Vec<(String, Target)>,
) -> Result<(), String> {
    let mut folder = transfer
        .folder
        .lock()
        .map_err(|_| "Dossier de destination occupé.")?;
    let Some(mount) = folder.as_ref() else {
        return Ok(());
    };
    if mount.confirm().is_err() {
        *folder = None;
        return Ok(());
    }
    if targets.iter().any(|(_, target)| same_folder(target, mount)) {
        return Ok(());
    }
    if rows.len() >= 256 {
        return Err("Trop de destinations détectées.".into());
    }
    let id = format!("mount:{}", transfer.serial.fetch_add(1, Ordering::Relaxed));
    rows.push(project(mount, &id));
    targets.push((id, Target::Mounted(mount.clone())));
    Ok(())
}
#[cfg(test)]
#[path = "transfer_folder_tests.rs"]
mod tests;
