//! DiscRecording enumerates connected writers even without media; BSD-only enumeration misses empty drives.
use super::macos_cf::{self as cf, Owned, Ref};
#[link(name = "DiscRecording", kind = "framework")]
unsafe extern "C" {
    fn DRCopyDeviceArray() -> Ref;
    fn DRDeviceCopyInfo(device: Ref) -> Ref;
    fn DRDeviceCopyStatus(device: Ref) -> Ref;
    fn DRDeviceCopyDeviceForIORegistryEntryPath(path: Ref) -> Ref;
    fn DRDeviceEjectMedia(device: Ref) -> i32;
    static kDRDeviceIORegistryEntryPathKey: Ref;
    static kDRDeviceProductNameKey: Ref;
    static kDRDeviceMediaInfoKey: Ref;
    static kDRDeviceMediaBSDNameKey: Ref;
}
pub(super) fn devices() -> Result<Vec<super::physical::Source>, String> {
    let held = Owned(unsafe { DRCopyDeviceArray() });
    let devices = cf::array(held.0, 16).ok_or("Détection des lecteurs CD impossible.")?;
    let mut sources = Vec::new();
    for device in devices {
        let info = Owned(unsafe { DRDeviceCopyInfo(device) });
        let status = Owned(unsafe { DRDeviceCopyStatus(device) });
        let Some(registry) = cf::text(cf::get(info.0, unsafe { kDRDeviceIORegistryEntryPathKey }))
        else {
            continue;
        };
        if !valid_registry(&registry) {
            continue;
        }
        let name = cf::text(cf::get(info.0, unsafe { kDRDeviceProductNameKey }))
            .unwrap_or_else(|| "Lecteur CD".into());
        let media = cf::get(status.0, unsafe { kDRDeviceMediaInfoKey });
        let media = cf::text(cf::get(media, unsafe { kDRDeviceMediaBSDNameKey }))
            .filter(|path| valid_bsd(path));
        sources.push(super::physical::Source {
            path: format!("dr:{registry}"),
            name,
            media,
        });
    }
    Ok(sources)
}
pub(super) fn valid_bsd(path: &str) -> bool {
    path.strip_prefix("disk")
        .is_some_and(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
}
fn valid_registry(path: &str) -> bool {
    path.starts_with("IOService:/") && path.len() <= 4096 && !path.chars().any(char::is_control)
}
pub(super) fn eject(path: &str) -> Result<(), String> {
    let registry = path
        .strip_prefix("dr:")
        .filter(|p| valid_registry(p))
        .ok_or("Lecteur CD invalide.")?;
    let name = cf::string(registry).ok_or("Lecteur CD invalide.")?;
    let device = Owned(unsafe { DRDeviceCopyDeviceForIORegistryEntryPath(name.0) });
    if device.0.is_null() {
        return Err("Le lecteur CD est absent ou inaccessible.".into());
    }
    // Exact registry identity, never a mutable drive index or an untrusted shell command.
    if unsafe { DRDeviceEjectMedia(device.0) } != 0 {
        return Err("Le système a refusé l’éjection du CD.".into());
    }
    Ok(())
}
#[cfg(test)]
#[path = "macos_tests.rs"]
mod tests;
