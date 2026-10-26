use super::*;
#[test]
fn empty_optical_hardware_keeps_a_model_and_registry_identity_without_a_media_path() {
    let info = cf::property_list(br#"<plist><dict><key>Vendor Name</key><string>ASUS</string><key>Product Name</key><string>SDRW-08U7M-U</string></dict></plist>"#).unwrap();
    let row = source("IOService:/Example/Optical", info.0, None).unwrap();
    assert_eq!(row.name, "ASUS SDRW-08U7M-U");
    assert_eq!(row.path, "dr:IOService:/Example/Optical");
    assert!(row.media.is_none());
    let row = source("IOService:/Example/Optical", info.0, Some("disk6".into())).unwrap();
    assert_eq!(row.media.as_deref(), Some("disk6"));
}
#[test]
fn invalid_registry_and_non_native_media_paths_are_not_admitted() {
    for path in ["", "/tmp/file", "IOService:/Bad\n"] {
        assert!(source(path, ptr::null(), None).is_none());
    }
    for media in ["/dev/disk6", "disk6s1", "disk6;bad", "disk6\n"] {
        let row = source(
            "IOService:/Example/Optical",
            ptr::null(),
            Some(media.into()),
        )
        .unwrap();
        assert_eq!(row.name, "Lecteur CD");
        assert!(row.media.is_none());
    }
}
