//! Minimal Core Foundation ownership/type boundary for native optical metadata. No borrowed reference escapes.
use std::{
    ffi::{CString, c_char, c_void},
    ptr,
};
pub(super) type Ref = *const c_void;
#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFRelease(value: Ref);
    fn CFGetTypeID(value: Ref) -> usize;
    fn CFArrayGetTypeID() -> usize;
    fn CFArrayGetCount(value: Ref) -> isize;
    fn CFArrayGetValueAtIndex(value: Ref, index: isize) -> Ref;
    fn CFDictionaryGetTypeID() -> usize;
    fn CFDictionaryGetValue(value: Ref, key: Ref) -> Ref;
    fn CFStringGetTypeID() -> usize;
    fn CFStringCreateWithCString(allocator: Ref, value: *const c_char, encoding: u32) -> Ref;
    fn CFStringGetCString(value: Ref, buffer: *mut c_char, size: isize, encoding: u32) -> bool;
}
pub(super) struct Owned(pub Ref);
impl Drop for Owned {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { CFRelease(self.0) };
        }
    }
}
pub(super) fn string(value: &str) -> Option<Owned> {
    let value = CString::new(value).ok()?;
    let result =
        Owned(unsafe { CFStringCreateWithCString(ptr::null(), value.as_ptr(), 0x08000100) });
    (!result.0.is_null()).then_some(result)
}
pub(super) fn text(value: Ref) -> Option<String> {
    if value.is_null() || unsafe { CFGetTypeID(value) != CFStringGetTypeID() } {
        return None;
    }
    let mut buffer = [0u8; 4096];
    if !unsafe {
        CFStringGetCString(
            value,
            buffer.as_mut_ptr().cast(),
            buffer.len() as isize,
            0x08000100,
        )
    } {
        return None;
    }
    let end = buffer.iter().position(|b| *b == 0)?;
    Some(std::str::from_utf8(&buffer[..end]).ok()?.into())
}
pub(super) fn get(value: Ref, key: Ref) -> Ref {
    if value.is_null() || unsafe { CFGetTypeID(value) != CFDictionaryGetTypeID() } {
        return ptr::null();
    }
    unsafe { CFDictionaryGetValue(value, key) }
}
pub(super) fn array(value: Ref, limit: usize) -> Option<Vec<Ref>> {
    if value.is_null() || unsafe { CFGetTypeID(value) != CFArrayGetTypeID() } {
        return None;
    }
    let count = usize::try_from(unsafe { CFArrayGetCount(value) }).ok()?;
    if count > limit {
        return None;
    }
    Some(
        (0..count)
            .map(|i| unsafe { CFArrayGetValueAtIndex(value, i as isize) })
            .collect(),
    )
}
