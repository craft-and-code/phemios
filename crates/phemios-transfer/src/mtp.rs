//! Bounded, additive MTP transfers with exact storage admission and streamed read-back.
use futures::{executor::block_on, stream};
use mtp_rs::{MtpDevice, NewObjectInfo, ObjectHandle, StorageId};
use std::{fs::File, io::Read, ops::ControlFlow, path::Path, time::Duration};
/// A USB identity and storage observed during explicit discovery.
#[derive(Clone)]
pub struct MtpTarget {
    /// Non-secret identity for the native registry, not a filesystem path.
    pub id: String,
    /// Device and storage name.
    pub name: String,
    location: u64,
    serial: Option<String>,
    vendor: u16,
    product: u16,
    storage: StorageId,
    /// Reported storage free space, in bytes.
    pub free: u64,
}
/// Enumerate only reported MTP devices and writable-capable storages; errors remain visible to the caller.
pub fn discover_mtp() -> Result<Vec<MtpTarget>, String> {
    let devices = MtpDevice::list_devices().map_err(|e| format!("Détection MTP : {e}"))?;
    if devices.len() > 32 {
        return Err("Trop de lecteurs MTP détectés.".into());
    }
    block_on(async {
        let mut targets = Vec::new();
        for info in devices {
            let device = MtpDevice::builder()
                .timeout(Duration::from_secs(3))
                .open_by_location(info.location_id)
                .await
                .map_err(|e| format!("Accès MTP : {e}"))?;
            if device.supports_upload() {
                for storage in device
                    .storages()
                    .await
                    .map_err(|e| format!("Stockage MTP : {e}"))?
                {
                    targets.push(MtpTarget {
                        id: format!("mtp:{}:{:?}", info.location_id, storage.id()),
                        name: format!(
                            "{} · {}",
                            info.product.as_deref().unwrap_or("MTP"),
                            storage.info().description
                        ),
                        location: info.location_id,
                        serial: info.serial_number.clone(),
                        vendor: info.vendor_id,
                        product: info.product_id,
                        storage: storage.id(),
                        free: storage.info().free_space,
                    });
                }
            }
            device
                .close()
                .await
                .map_err(|e| format!("Fermeture MTP : {e}"))?;
        }
        Ok(targets)
    })
}
impl MtpTarget {
    /// Preserve all existing objects. Existing equal bytes may be skipped only after requested read-back.
    /// Failed uploads clean up only the new object handle returned by this exact upload.
    pub fn upload(
        &self,
        relative: &Path,
        source: &Path,
        verify: bool,
        valid: &(dyn Fn() -> Result<(), String> + Sync),
    ) -> Result<(), String> {
        valid()?;
        let parts: Vec<String> = relative
            .components()
            .map(|p| {
                p.as_os_str()
                    .to_str()
                    .map(str::to_owned)
                    .ok_or("Chemin MTP invalide.")
            })
            .collect::<Result<_, _>>()?;
        crate::relative(&parts)?;
        let now = MtpDevice::list_devices().map_err(|e| e.to_string())?;
        if !now.iter().any(|i| {
            i.location_id == self.location
                && i.serial_number == self.serial
                && i.vendor_id == self.vendor
                && i.product_id == self.product
        }) {
            return Err("Le lecteur MTP a changé ou a été débranché.".into());
        }
        block_on(async {
            let device = MtpDevice::builder()
                .timeout(Duration::from_secs(5))
                .open_by_location(self.location)
                .await
                .map_err(|e| e.to_string())?;
            let result = async {
                let storage = device
                    .storage(self.storage)
                    .await
                    .map_err(|e| e.to_string())?;
                let size = std::fs::metadata(source).map_err(|e| e.to_string())?.len();
                let mut parent = None;
                let components: Vec<_> = relative
                    .components()
                    .map(|c| c.as_os_str().to_str().ok_or("Nom MTP invalide."))
                    .collect::<Result<_, _>>()?;
                for name in &components[..components.len().saturating_sub(1)] {
                    valid()?;
                    if let Some(row) = find(&storage,parent,name,valid).await? {
                        if !row.is_folder() { return Err("Un fichier MTP occupe le nom du dossier.".into()); }
                        parent = Some(row.handle);
                    } else { parent = Some(storage.create_folder(parent, name).await.map_err(|e| e.to_string())?); }
                }
                let name = components.last().ok_or("Nom MTP absent.")?;
                if let Some(existing) = find(&storage,parent,name,valid).await? {
                    if !existing.is_file() || existing.size != size { return Err("Ce fichier existe déjà et diffère sur le lecteur MTP ; il est conservé.".into()); }
                    return if verify { verify_object(&storage,existing.handle,source,valid).await } else { valid() };
                }
                if storage.info().free_space < size { return Err("Espace MTP insuffisant.".into()); }
                let mut file = File::open(source).map_err(|e| e.to_string())?;
                let chunks = stream::poll_fn(move |_| {
                    let mut buffer = vec![0; 64 * 1024];
                    let result = file.read(&mut buffer).map(|n| {
                        buffer.truncate(n);
                        bytes::Bytes::from(buffer)
                    });
                    std::task::Poll::Ready(match result {
                        Ok(b) if b.is_empty() => None,
                        other => Some(other),
                    })
                });
                let handle = match storage
                    .upload_with_progress(parent, NewObjectInfo::file(*name, size), chunks, |_| {
                        if valid().is_ok() {
                            ControlFlow::Continue(())
                        } else {
                            ControlFlow::Break(())
                        }
                    })
                    .await
                {
                    Ok(handle) => handle,
                    Err(error) => {
                        if let Some(handle) = error.partial {
                            storage.delete(handle).await.map_err(|cleanup| {
                                format!(
                                    "Transfert MTP interrompu ; nettoyage impossible : {cleanup}"
                                )
                            })?;
                        }
                        return Err(format!("Transfert MTP : {}", error.source));
                    }
                };
                if verify {
                    let check = verify_object(&storage, handle, source, valid).await;
                    if let Err(error) = check {
                        storage
                            .delete(handle)
                            .await
                            .map_err(|e| format!("{error} ; nettoyage impossible : {e}"))?;
                        return Err(error);
                    }
                }
                valid()
            }
            .await;
            let closed = device
                .close()
                .await
                .map_err(|e| format!("Fermeture MTP : {e}"));
            result.and(closed)
        })
    }
}
async fn verify_object(
    storage: &mtp_rs::Storage,
    handle: ObjectHandle,
    source: &Path,
    valid: &(dyn Fn() -> Result<(), String> + Sync),
) -> Result<(), String> {
    let mut download = storage
        .download(handle, mtp_rs::ByteRange::Full)
        .await
        .map_err(|e| e.to_string())?;
    let result = async {
        let mut file = File::open(source).map_err(|e| e.to_string())?;
        while let Some(chunk) = download.next_chunk().await {
            valid()?;
            let chunk = chunk.map_err(|e| e.to_string())?;
            let mut expected = [0; 64 * 1024];
            for part in chunk.chunks(expected.len()) {
                file.read_exact(&mut expected[..part.len()])
                    .map_err(|e| e.to_string())?;
                if &expected[..part.len()] != part {
                    return Err("La vérification MTP a échoué.".into());
                }
            }
        }
        if file.read(&mut [0; 1]).map_err(|e| e.to_string())? != 0 {
            return Err("Le fichier MTP est incomplet.".into());
        }
        Ok(())
    }
    .await;
    if result.is_err() {
        download
            .cancel(Duration::from_secs(3))
            .await
            .map_err(|e| format!("Arrêt de la vérification MTP : {e}"))?;
    }
    result
}

async fn find(
    storage: &mtp_rs::Storage,
    parent: Option<ObjectHandle>,
    name: &str,
    valid: &(dyn Fn() -> Result<(), String> + Sync),
) -> Result<Option<mtp_rs::ObjectInfo>, String> {
    let mut listing = storage
        .list_objects_stream(parent)
        .await
        .map_err(|e| e.to_string())?;
    if listing.total() > 100_000 {
        return Err("Le dossier MTP contient trop d’éléments.".into());
    }
    let mut found = None;
    while let Some(item) = listing.next().await {
        valid()?;
        match item.map_err(|e| e.to_string())? {
            mtp_rs::ListingItem::Object(row) => {
                if row.filename.eq_ignore_ascii_case(name) {
                    if found.is_some() {
                        return Err("Plusieurs fichiers MTP portent le même nom.".into());
                    }
                    found = Some(row);
                }
            }
            mtp_rs::ListingItem::Skipped(_) => {
                return Err(
                    "Le contenu du dossier MTP n’a pas pu être vérifié intégralement.".into(),
                );
            }
        }
    }
    Ok(found)
}
#[cfg(test)]
#[path = "mtp_tests.rs"]
mod tests;
