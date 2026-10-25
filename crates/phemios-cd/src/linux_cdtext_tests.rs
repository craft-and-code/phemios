use super::*;
use crate::cdtext_io::CAPACITY;
fn fill(request: &mut Header) {
    let bytes = crate::cdtext_fixtures::response();
    assert_eq!(request.length as usize, CAPACITY);
    // SAFETY: query_with owns this live CAPACITY-byte output for the complete synchronous fixture callback.
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), request.data.cast::<u8>(), bytes.len());
    }
    request.residual = (CAPACITY - bytes.len()) as i32;
}
#[test]
fn fixed_read_only_command_decodes_the_transferred_text_and_keeps_the_linux_abi() {
    let result = query_with(|request| {
        assert_eq!(SG_IO, 0x2285);
        assert_eq!(request.interface, i32::from(b'S'));
        assert_eq!(request.direction, -3);
        assert_eq!(request.timeout_ms, 10000);
        assert_eq!(request.command_length, 10);
        assert_eq!(request.sense_length, 64);
        assert_eq!(request.iovec_count, 0);
        assert_eq!(request.flags, 0);
        // SAFETY: the fixed ten-byte CDB is alive throughout this callback.
        assert_eq!(
            unsafe { std::slice::from_raw_parts(request.command, 10) },
            [0x43, 0, 5, 0, 0, 0, 0, 0x80, 0, 0]
        );
        fill(request);
        0
    })
    .expect("valid Linux CD-Text response");
    assert_eq!(result[0], (Some("Café".into()), Some("Band".into())));
    assert_eq!(result[1].0.as_deref(), Some("Song"));
    #[cfg(target_pointer_width = "64")]
    {
        assert_eq!(size_of::<Header>(), 88);
        assert_eq!(std::mem::offset_of!(Header, data), 16);
        assert_eq!(std::mem::offset_of!(Header, residual), 72);
    }
}
#[test]
fn driver_scsi_and_host_failures_never_become_metadata_even_with_valid_payloads() {
    for mode in 0..12 {
        assert!(
            query_with(|request| {
                fill(request);
                match mode {
                    0 => return -1,
                    1 => request.status = 2,
                    2 => request.host_status = 1,
                    3 => request.driver_status = 1,
                    4 => request.info = 1,
                    5 => request.residual = -1,
                    6 => request.residual = CAPACITY as i32 + 1,
                    7 => request.residual = CAPACITY as i32 - 3,
                    8 => request.masked_status = 1,
                    9 => request.message_status = 1,
                    10 => request.sense_written = 65,
                    _ => return 1,
                }
                0
            })
            .is_none(),
            "mode {mode}"
        );
    }
}
#[test]
fn only_linux_optical_device_names_or_the_discovered_cdrom_alias_are_admitted() {
    for path in ["/dev/sr0", "/dev/sr23", "/dev/cdrom"] {
        assert!(valid_path(path));
    }
    for path in [
        "",
        "/dev/sr",
        "/dev/sda",
        "/tmp/music.flac",
        "/dev/sr0/../sda",
        "/dev/cdrom-extra",
        "/dev/sr0\n",
    ] {
        assert!(!valid_path(path));
    }
}
