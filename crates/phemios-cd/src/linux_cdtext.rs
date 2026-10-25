//! Read-only MMC READ TOC (format 5) through Linux SG_IO; never a generic command interface.
use std::{ffi::c_void, ptr};
const SG_IO: std::ffi::c_ulong = 0x2285;
// Linux UAPI scsi/sg.h. Pointers refer only to stack buffers alive throughout the synchronous ioctl.
#[repr(C)]
struct Header {
    interface: i32,
    direction: i32,
    command_length: u8,
    sense_length: u8,
    iovec_count: u16,
    length: u32,
    data: *mut c_void,
    command: *mut u8,
    sense: *mut u8,
    timeout_ms: u32,
    flags: u32,
    pack_id: i32,
    user: *mut c_void,
    status: u8,
    masked_status: u8,
    message_status: u8,
    sense_written: u8,
    host_status: u16,
    driver_status: u16,
    residual: i32,
    duration: u32,
    info: u32,
}
fn valid_path(path: &str) -> bool {
    path == "/dev/cdrom"
        || path
            .strip_prefix("/dev/sr")
            .is_some_and(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
}
fn query_with(execute: impl FnOnce(&mut Header) -> i32) -> Option<super::cdtext_packs::Rows> {
    use super::cdtext_io::{CAPACITY, finish};
    let mut bytes = [0u8; CAPACITY];
    let mut command = [0x43, 0, 5, 0, 0, 0, 0, 0x80, 0, 0];
    let mut sense = [0u8; 64];
    let mut request = Header {
        interface: i32::from(b'S'),
        direction: -3,
        command_length: command.len() as u8,
        sense_length: sense.len() as u8,
        iovec_count: 0,
        length: CAPACITY as u32,
        data: bytes.as_mut_ptr().cast(),
        command: command.as_mut_ptr(),
        sense: sense.as_mut_ptr(),
        timeout_ms: 10000,
        flags: 0,
        pack_id: 0,
        user: ptr::null_mut(),
        status: 0,
        masked_status: 0,
        message_status: 0,
        sense_written: 0,
        host_status: 0,
        driver_status: 0,
        residual: 0,
        duration: 0,
        info: 0,
    };
    if execute(&mut request) != 0
        || request.status != 0
        || request.masked_status != 0
        || request.message_status != 0
        || request.host_status != 0
        || request.driver_status != 0
        || request.info & 1 != 0
        || request.sense_written > request.sense_length
    {
        return None;
    }
    let residual = usize::try_from(request.residual).ok()?;
    finish(&bytes, CAPACITY.checked_sub(residual)?)
}
#[cfg(target_os = "linux")]
pub(super) fn read(path: &str) -> Option<super::cdtext_packs::Rows> {
    use std::{
        fs::OpenOptions,
        os::{fd::AsRawFd, unix::fs::OpenOptionsExt},
    };
    if !valid_path(path) {
        return None;
    }
    // O_NONBLOCK avoids waiting for insertion. No write access, privilege prompt or permission change.
    let file = OpenOptions::new()
        .read(true)
        .custom_flags(0x800)
        .open(path)
        .ok()?;
    unsafe extern "C" {
        fn ioctl(fd: i32, request: std::ffi::c_ulong, ...) -> i32;
    }
    query_with(|request| {
        // SAFETY: Linux's UAPI layout, fixed read-only CDB and bounded live buffers; ioctl is synchronous.
        unsafe { ioctl(file.as_raw_fd(), SG_IO, request as *mut Header) }
    })
}
#[cfg(test)]
#[path = "linux_cdtext_tests.rs"]
mod tests;
