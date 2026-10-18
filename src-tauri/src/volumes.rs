//! Explicit mounted/MTP discovery and safe non-forced ejection use native-only destination identities.
use crate::{
    aede::{blocking, bridge},
    transfer::{Target, Transfers},
};
use serde_json::{Value, json};
use std::sync::{Arc, atomic::Ordering};
use tauri::State;
#[tauri::command]
pub(crate) async fn players_discover(
    version: u32,
    transfer: State<'_, Arc<Transfers>>,
) -> Result<Value, String> {
    bridge(version)?;
    let transfer = transfer.inner().clone();
    blocking(move || {
        // A refresh cannot invalidate the selected native identities of a running job.
        if transfer.running.load(Ordering::Acquire) {
            return transfer.inventory.lock().map(|v| v.clone()).map_err(|_| "Lecteurs indisponibles.".into());
        }
        let _destinations = transfer.idle_destinations()?;
        let mut rows = Vec::new(); let mut targets = Vec::new(); let mut volumes = Vec::new();
        let mut warnings = Vec::new();
        let discovered = match phemios_core::volumes::discover() {
            Ok(volumes) => volumes,
            Err(error) => { warnings.push(error); Vec::new() },
        };
        for volume in discovered {
            let target = match phemios_transfer::Mounted::capture(volume.path.clone().into()) {
                Ok(target) => target,
                Err(error) => { warnings.push(error); continue; },
            };
            let id = format!("mount:{}", transfer.serial.fetch_add(1, Ordering::Relaxed));
            let mut row = volume.json();
            row["id"] = id.clone().into();
            row["adapter"] = if target.apple_ipod() { "ipod" } else { "mounted" }.into();
            let reason = if target.apple_ipod() {
                if volume.ipod_supported == Some(false) { "Ce modèle d’iPod n’est pas pris en charge par podkit." }
                else if !std::fs::symlink_metadata(target.path().join("iPod_Control/iTunes/iTunesDB")).is_ok_and(|m| m.is_file()) { "Base iTunesDB compatible absente. Aucune initialisation automatique." }
                else if !phemios_transfer::podkit_available() { "Installez podkit pour transférer vers un iPod Apple compatible." }
                else { "" }
            } else { "" };
            row["available"] = reason.is_empty().into();
            row["unavailableReason"] = reason.into();
            rows.push(row); volumes.push((id.clone(), volume)); targets.push((id, Target::Mounted(target)));
        }
        match phemios_transfer::discover_mtp() {
            Ok(devices) => for device in devices {
                let id = format!("mtp:{}", transfer.serial.fetch_add(1, Ordering::Relaxed));
                rows.push(json!({"id":id,"name":device.name,"path":device.id,"format":"MTP","kind":"removable","adapter":"mtp","available":true,"free":device.free,"ejectable":false}));
                targets.push((id, Target::Mtp(device)));
            },
            Err(error) => warnings.push(error),
        }
        crate::transfer_folder::retain(&transfer, &mut rows, &mut targets)?;
        transfer.retire_preview()?;
        *transfer.targets.lock().map_err(|_| "Lecteurs occupés.")? = targets;
        *transfer.volumes.lock().map_err(|_| "Lecteurs occupés.")? = volumes;
        let result = json!({"volumes":rows,"warning":warnings.join("\n")});
        *transfer.inventory.lock().map_err(|_| "Lecteurs indisponibles.")? = result.clone();
        Ok(result)
    }).await
}
#[tauri::command]
pub(crate) async fn players_eject(
    version: u32,
    id: String,
    transfer: State<'_, Arc<Transfers>>,
) -> Result<(), String> {
    bridge(version)?;
    let transfer = transfer.inner().clone();
    blocking(move || {
        eject(&transfer, &id, |volume, mount| {
            volume.eject(|| mount.confirm())
        })
    })
    .await
}
fn eject(
    transfer: &Transfers,
    id: &str,
    action: impl FnOnce(
        &phemios_core::volumes::Volume,
        &phemios_transfer::Mounted,
    ) -> Result<(), String>,
) -> Result<(), String> {
    let _destinations = transfer.idle_destinations()?;
    let targets = transfer.targets.lock().map_err(|_| "Lecteurs occupés.")?;
    let mount = targets
        .iter()
        .find_map(|(key, target)| match target {
            Target::Mounted(mount) if key == id => Some(mount),
            _ => None,
        })
        .ok_or("Actualisez puis sélectionnez le lecteur.")?;
    let mut volumes = transfer.volumes.lock().map_err(|_| "Lecteurs occupés.")?;
    let volume = &volumes
        .iter()
        .find(|(key, _)| key == id)
        .ok_or("Lecteur indisponible.")?
        .1;
    if !volume.ejectable {
        return Err("Éjectez ce lecteur depuis votre système d’exploitation.".into());
    }
    mount.confirm()?;
    transfer.retire_preview()?;
    action(volume, mount)?;
    drop(targets);
    transfer
        .targets
        .lock()
        .map_err(|_| "Lecteurs occupés.")?
        .retain(|(key, _)| key != id);
    volumes.retain(|(key, _)| key != id);
    if let Some(rows) = transfer
        .inventory
        .lock()
        .map_err(|_| "Lecteurs indisponibles.")?["volumes"]
        .as_array_mut()
    {
        rows.retain(|row| row["id"] != id);
    }
    Ok(())
}
#[cfg(test)]
#[path = "volumes_tests.rs"]
mod tests;
