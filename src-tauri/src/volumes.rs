//! Explicit mounted/MTP destination discovery registers native identities before exposing selectors.
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
    blocking(move||{
        let mut rows=Vec::new(); let mut targets=Vec::new();
        for volume in phemios_core::volumes::discover()? {
            let target=phemios_transfer::Mounted::capture(volume.path.clone().into())?;
            let id=format!("mount:{}",transfer.serial.fetch_add(1,Ordering::Relaxed));
            let mut row=volume.json(); row["id"]=id.clone().into(); row["adapter"]=if target.apple_ipod(){"ipod"}else{"mounted"}.into();
            row["available"]=(!target.apple_ipod()||phemios_transfer::podkit_available()).into();
            rows.push(row); targets.push((id,Target::Mounted(target)));
        }
        let mut warning=String::new();
        match phemios_transfer::discover_mtp(){
            Ok(devices)=>for device in devices {
                let id=format!("mtp:{}",transfer.serial.fetch_add(1,Ordering::Relaxed));
                rows.push(json!({"id":id,"name":device.name,"path":device.id,"format":"MTP","kind":"removable","adapter":"mtp","available":true,"free":device.free}));
                targets.push((id,Target::Mtp(device)));
            },
            Err(error)=>warning=error,
        }
        *transfer.targets.lock().map_err(|_|"Lecteurs occupés.")?=targets;
        let result=json!({"volumes":rows,"warning":warning});
        *transfer.inventory.lock().map_err(|_|"Lecteurs indisponibles.")?=result.clone();
        Ok(result)
    }).await
}
