use super::*;
fn plist(id: &str, name: &str) -> Vec<u8> {
    format!(r#"<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>DeviceIdentifier</key><string>{id}</string><key>MediaName</key><string>{name}</string></dict></plist>"#).into_bytes()
}
#[test]
fn structured_system_name_is_bound_to_the_requested_native_drive() {
    assert_eq!(
        parse(&plist("disk6", " ASUS Writer &amp; CD "), "disk6").as_deref(),
        Some("ASUS Writer & CD")
    );
    assert!(parse(&plist("disk7", "Other Writer"), "disk6").is_none());
}
#[test]
fn invalid_oversized_and_wrongly_typed_system_output_never_supply_a_name() {
    for bytes in [Vec::new(),b"invalid plist".to_vec(),vec![b'x';8193],
        b"<plist><array><string>ASUS</string></array></plist>".to_vec(),
        b"<plist><dict><key>DeviceIdentifier</key><string>disk6</string><key>MediaName</key><true/></dict></plist>".to_vec(),
        plist("disk6","Bad&#10;Writer"),plist("disk6", " ")] {
        assert!(parse(&bytes,"disk6").is_none());
    }
    assert_eq!(
        parse(&plist("disk6", &"𝄞".repeat(201)), "disk6")
            .unwrap()
            .encode_utf16()
            .count(),
        200
    );
}
#[test]
fn metadata_command_is_fixed_read_only_and_refuses_arbitrary_paths() {
    let query = command("disk6").unwrap();
    assert_eq!(query.get_program(), "/usr/sbin/diskutil");
    assert_eq!(
        query.get_args().collect::<Vec<_>>(),
        ["info", "-plist", "disk6"]
    );
    for path in ["/dev/disk6", "disk6s1", "disk6;echo bad", "disk6\n", ""] {
        assert!(command(path).is_none());
        assert!(parse(&plist("disk6", "Writer"), path).is_none());
    }
}
