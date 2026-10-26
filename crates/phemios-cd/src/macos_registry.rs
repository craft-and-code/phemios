//! Read-only IOKit optical hardware discovery independent of inserted media and DiscRecording's snapshot.
use super::{
    macos,
    macos_cf::{self as cf, Owned, Ref},
    physical::Source,
};
use std::{ffi::c_char, ptr};
#[link(name = "IOKit", kind = "framework")]
unsafe extern "C" {
    fn IOServiceMatching(name: *const c_char) -> Ref;
    fn IOServiceGetMatchingServices(port: u32, matching: Ref, iterator: *mut u32) -> i32;
    fn IOIteratorNext(iterator: u32) -> u32;
    fn IOObjectRelease(object: u32) -> i32;
    fn IORegistryEntryCopyPath(entry: u32, plane: *const c_char) -> Ref;
    fn IORegistryEntryCreateCFProperty(entry: u32, key: Ref, allocator: Ref, options: u32) -> Ref;
    fn IORegistryEntrySearchCFProperty(
        entry: u32,
        plane: *const c_char,
        key: Ref,
        allocator: Ref,
        options: u32,
    ) -> Ref;
}
/// Exact native identity plus unmodified selector strings used only by the system tray fallback.
pub(super) struct Hardware {
    pub source: Source,
    pub vendor: Option<String>,
    pub product: Option<String>,
}
struct Handle(u32);
impl Drop for Handle {
    fn drop(&mut self) {
        if self.0 != 0 {
            // Each iterator/service has one owned IOKit reference, distinct from CF ownership.
            unsafe {
                IOObjectRelease(self.0);
            }
        }
    }
}
/// Only the native optical storage class (including DVD/BD subclasses), never general disks or user paths.
pub(super) fn devices() -> Result<Vec<Source>, String> {
    Ok(inventory()?.into_iter().map(|row| row.source).collect())
}
/// Refresh the optical-only snapshot immediately before selecting a system-tool target.
pub(super) fn inventory() -> Result<Vec<Hardware>, String> {
    // IOServiceGetMatchingServices consumes the matching dictionary, including on failure.
    let matching = unsafe { IOServiceMatching(c"IOCDBlockStorageDevice".as_ptr()) };
    if matching.is_null() {
        return Err("Détection des lecteurs CD impossible.".into());
    }
    let mut raw = 0;
    let status = unsafe { IOServiceGetMatchingServices(0, matching, &mut raw) };
    let iterator = Handle(raw);
    if status != 0 {
        return Err("Détection des lecteurs CD impossible.".into());
    }
    let mut sources = Vec::new();
    if iterator.0 == 0 {
        return Ok(sources);
    }
    // Bound enumeration even if a driver supplies malformed entries.
    for _ in 0..17 {
        let entry = Handle(unsafe { IOIteratorNext(iterator.0) });
        if entry.0 == 0 {
            return Ok(sources);
        }
        if sources.len() == 16 {
            return Err("Trop de lecteurs CD détectés.".into());
        }
        if let Some(source) = describe(entry.0) {
            sources.push(source);
        }
    }
    Err("Trop de lecteurs CD détectés.".into())
}
fn describe(entry: u32) -> Option<Hardware> {
    let path = Owned(unsafe { IORegistryEntryCopyPath(entry, c"IOService".as_ptr()) });
    let path = cf::text(path.0)?;
    let key = cf::string("Device Characteristics")?;
    let info = Owned(unsafe { IORegistryEntryCreateCFProperty(entry, key.0, ptr::null(), 0) });
    let key = cf::string("BSD Name")?;
    // Search only optical descendants (kIORegistryIterateRecursively = 1), not parents/other devices.
    let media = Owned(unsafe {
        IORegistryEntrySearchCFProperty(entry, c"IOService".as_ptr(), key.0, ptr::null(), 1)
    });
    let vendor = cf::string("Vendor Name")?;
    let product = cf::string("Product Name")?;
    Some(Hardware {
        source: source(&path, info.0, cf::text(media.0))?,
        vendor: cf::text(cf::get(info.0, vendor.0)),
        product: cf::text(cf::get(info.0, product.0)),
    })
}
fn source(path: &str, info: Ref, media: Option<String>) -> Option<Source> {
    if !macos::valid_registry(path) {
        return None;
    }
    let vendor = cf::string("Vendor Name")?;
    let product = cf::string("Product Name")?;
    let vendor = cf::text(cf::get(info, vendor.0));
    let product = cf::text(cf::get(info, product.0));
    Some(Source {
        path: format!("dr:{path}"),
        name: macos::display_name(vendor.as_deref(), product.as_deref()),
        media: media.filter(|path| macos::valid_bsd(path)),
    })
}
#[cfg(test)]
#[path = "macos_registry_tests.rs"]
mod tests;
