//! Read optional CD-Text through SDK DKIOCCDREADTOC format 5; all bytes enter the bounded safe parser.
use std::{fs::File, os::fd::AsRawFd};
#[repr(C)]
struct TocRequest {
    format: u8,
    time: u8,
    reserved: [u8; 5],
    address: u8,
    reserved64: [u8; 6],
    length: u16,
    buffer: *mut u8,
}
unsafe extern "C" {
    fn ioctl(fd: i32, request: std::ffi::c_ulong, ...) -> i32;
}
pub(super) fn read(path: &str) -> Option<super::cdtext_packs::Rows> {
    if !super::macos::valid_bsd(path) {
        return None;
    }
    let file = File::open(format!("/dev/r{path}")).ok()?;
    let mut bytes = [0u8; super::cdtext_io::CAPACITY];
    let mut request = TocRequest {
        format: 5,
        time: 0,
        reserved: [0; 5],
        address: 0,
        reserved64: [0; 6],
        length: bytes.len() as u16,
        buffer: bytes.as_mut_ptr(),
    };
    // _IOWR('d', 100, dk_cd_read_toc_t), native 64-bit SDK layout.
    let command = 0xc0000000 | ((size_of::<TocRequest>() as std::ffi::c_ulong) << 16) | 0x6464;
    if unsafe { ioctl(file.as_raw_fd(), command, &mut request) } != 0 {
        return None;
    }
    super::cdtext_io::finish(&bytes, usize::from(request.length))
}
#[cfg(test)]
#[path = "macos_cdtext_tests.rs"]
mod tests;
