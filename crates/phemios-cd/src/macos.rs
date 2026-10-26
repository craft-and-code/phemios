//! DiscRecording enumerates connected writers even without media; BSD-only enumeration misses empty drives.
use super::macos_cf::{self as cf, Owned, Ref};
#[link(name = "DiscRecording", kind = "framework")]
unsafe extern "C" {
    fn DRCopyDeviceArray() -> Ref;
    fn DRDeviceCopyInfo(device: Ref) -> Ref;
    fn DRDeviceCopyStatus(device: Ref) -> Ref;
    fn DRDeviceCopyDeviceForIORegistryEntryPath(path: Ref) -> Ref;
    fn DRDeviceCopyDeviceForBSDName(name: Ref) -> Ref;
    fn DRDeviceEjectMedia(device: Ref) -> i32;
    static kDRDeviceIORegistryEntryPathKey: Ref;
    static kDRDeviceProductNameKey: Ref;
    static kDRDeviceVendorNameKey: Ref;
    static kDRDeviceMediaInfoKey: Ref;
    static kDRDeviceMediaBSDNameKey: Ref;
}
pub(super) fn devices() -> Result<Vec<super::physical::Source>, String> {
    let held = Owned(unsafe { DRCopyDeviceArray() });
    let devices = cf::array(held.0, 16).ok_or("Détection des lecteurs CD impossible.")?;
    let mut sources = Vec::new();
    for device in devices {
        if let Some(source) = describe(device, None) {
            sources.push(source);
        }
    }
    Ok(sources)
}
// The BSD name comes only from native optical enumeration. This read-only API recovers
// metadata for readable media that the writer snapshot omitted, without reading audio.
pub(super) fn source_for_bsd(path: &str) -> Option<super::physical::Source> {
    if !valid_bsd(path) {
        return None;
    }
    let name = cf::string(path)?;
    let device = Owned(unsafe { DRDeviceCopyDeviceForBSDName(name.0) });
    describe(device.0, Some(path))
}
fn describe(device: Ref, bsd: Option<&str>) -> Option<super::physical::Source> {
    if device.is_null() {
        return None;
    }
    let info = Owned(unsafe { DRDeviceCopyInfo(device) });
    let registry = cf::text(cf::get(info.0, unsafe { kDRDeviceIORegistryEntryPathKey }))?;
    if !valid_registry(&registry) {
        return None;
    }
    let vendor = cf::text(cf::get(info.0, unsafe { kDRDeviceVendorNameKey }));
    let product = cf::text(cf::get(info.0, unsafe { kDRDeviceProductNameKey }));
    let name = display_name(vendor.as_deref(), product.as_deref());
    let media = if let Some(path) = bsd {
        Some(path.to_owned())
    } else {
        let status = Owned(unsafe { DRDeviceCopyStatus(device) });
        let media = cf::get(status.0, unsafe { kDRDeviceMediaInfoKey });
        cf::text(cf::get(media, unsafe { kDRDeviceMediaBSDNameKey })).filter(|path| valid_bsd(path))
    };
    Some(super::physical::Source {
        path: format!("dr:{registry}"),
        name,
        media,
    })
}
pub(super) fn display_name(vendor: Option<&str>, product: Option<&str>) -> String {
    let clean = |s: &&str| !s.trim().is_empty() && !s.chars().any(char::is_control);
    let vendor = vendor.filter(clean).map(str::trim);
    let product = product.filter(clean).map(str::trim);
    let label = match (vendor, product) {
        (Some(vendor), Some(product))
            if !product.to_lowercase().starts_with(&vendor.to_lowercase()) =>
        {
            format!("{vendor} {product}")
        }
        (_, Some(product)) => product.into(),
        (Some(vendor), None) => vendor.into(),
        _ => "Lecteur CD".into(),
    };
    // The bridge admits at most 200 UTF-16 units, including supplementary Unicode letters.
    label.chars().take(100).collect()
}
pub(super) fn valid_bsd(path: &str) -> bool {
    path.strip_prefix("disk")
        .is_some_and(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
}
pub(super) fn valid_registry(path: &str) -> bool {
    path.starts_with("IOService:/") && path.len() <= 4096 && !path.chars().any(char::is_control)
}
pub(super) fn eject(path: &str) -> Result<(), String> {
    let registry = path
        .strip_prefix("dr:")
        .filter(|p| valid_registry(p))
        .ok_or("Lecteur CD invalide.")?;
    let name = cf::string(registry).ok_or("Lecteur CD invalide.")?;
    let device = Owned(unsafe { DRDeviceCopyDeviceForIORegistryEntryPath(name.0) });
    eject_resolved(
        device.0,
        |device| {
            // Exact registry identity. Native refusal must never dispatch another ejection.
            unsafe { DRDeviceEjectMedia(device) }
        },
        || super::macos_tray::eject(registry),
    )
}
fn eject_resolved(
    device: Ref,
    native: impl FnOnce(Ref) -> i32,
    fallback: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    if device.is_null() {
        return fallback();
    }
    if native(device) != 0 {
        return Err("Le système a refusé l’éjection du CD.".into());
    }
    Ok(())
}
#[cfg(test)]
#[path = "macos_tests.rs"]
mod tests;
