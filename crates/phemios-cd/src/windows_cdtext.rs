//! CDROM_READ_TOC_EX format CDTEXT requires only read access to a natively discovered optical volume.
const IOCTL_READ_TOC_EX: u32 = 0x00024054;
const QUERY: [u8; 4] = [5, 0, 0, 0];
fn valid_path(path: &str) -> bool {
    path.strip_prefix(r"\\.\")
        .and_then(|p| p.strip_suffix(':'))
        .is_some_and(|letter| letter.len() == 1 && letter.bytes().all(|b| b.is_ascii_uppercase()))
}
fn query_with(
    execute: impl FnOnce(&[u8; 4], &mut [u8]) -> Option<usize>,
) -> Option<super::cdtext_packs::Rows> {
    let mut bytes = [0u8; super::cdtext_io::CAPACITY];
    let transferred = execute(&QUERY, &mut bytes)?;
    super::cdtext_io::finish(&bytes, transferred)
}
#[cfg(target_os = "windows")]
pub(super) fn read(path: &str) -> Option<super::cdtext_packs::Rows> {
    use std::{
        ffi::c_void,
        fs::OpenOptions,
        os::windows::{fs::OpenOptionsExt, io::AsRawHandle},
        ptr,
    };
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn DeviceIoControl(
            handle: *mut c_void,
            code: u32,
            input: *const c_void,
            input_size: u32,
            output: *mut c_void,
            output_size: u32,
            returned: *mut u32,
            overlapped: *mut c_void,
        ) -> i32;
    }
    if !valid_path(path) {
        return None;
    }
    // FILE_SHARE_READ | FILE_SHARE_WRITE permits existing readers; desired access stays GENERIC_READ.
    let file = OpenOptions::new()
        .read(true)
        .share_mode(3)
        .open(path)
        .ok()?;
    query_with(|input, output| {
        let mut returned = 0u32;
        // SAFETY: synchronous DeviceIoControl, fixed four-byte read query, bounded output and live owned handle.
        let success = unsafe {
            DeviceIoControl(
                file.as_raw_handle(),
                IOCTL_READ_TOC_EX,
                input.as_ptr().cast(),
                input.len() as u32,
                output.as_mut_ptr().cast(),
                output.len() as u32,
                &mut returned,
                ptr::null_mut(),
            )
        };
        (success != 0).then_some(returned as usize)
    })
}
#[cfg(test)]
#[path = "windows_cdtext_tests.rs"]
mod tests;
