use super::*;
#[test]
fn only_discovered_style_native_registry_and_bsd_identities_are_admitted() {
    assert!(valid_registry("IOService:/Example/Optical"));
    assert!(valid_bsd("disk9"));
    for value in ["", "disk", "disk9s1", "disk1;bad", "disk1\n", "/dev/disk0"] {
        assert!(!valid_bsd(value));
    }
    for value in ["", "disk9", "IOService:/bad\n", "/tmp/file"] {
        assert!(!valid_registry(value));
    }
    assert!(eject("dr:/tmp/file").is_err());
}

#[test]
fn hardware_names_include_vendor_without_duplicating_a_vendor_already_in_the_model() {
    assert_eq!(
        display_name(Some(" ASUS "), Some(" SDRW-08U7M-U ")),
        "ASUS SDRW-08U7M-U"
    );
    assert_eq!(display_name(Some("ASUS"), Some("Asus SDRW")), "Asus SDRW");
    assert_eq!(display_name(None, Some("Writer")), "Writer");
    assert_eq!(display_name(Some("Vendor"), None), "Vendor");
    assert_eq!(display_name(Some("Bad\nVendor"), Some("")), "Lecteur CD");
    assert!(
        display_name(None, Some(&"𝄞".repeat(201)))
            .encode_utf16()
            .count()
            <= 200
    );
}
#[test]
fn bsd_name_recovery_refuses_arbitrary_paths_without_calling_disc_recording() {
    for path in ["/dev/disk6", "disk6s1", "disk6;whoami", "disk6\n", ""] {
        assert!(source_for_bsd(path).is_none());
    }
}

#[test]
fn unresolved_disc_recording_device_uses_the_exact_hardware_fallback() {
    assert!(eject_resolved(std::ptr::null(), |_| panic!("no device"), || Ok(())).is_ok());
    assert_eq!(
        eject_resolved(
            std::ptr::null(),
            |_| panic!("no device"),
            || Err("removed".into())
        )
        .unwrap_err(),
        "removed"
    );
}
#[test]
fn native_ejection_success_and_refusal_never_dispatch_a_second_ejection() {
    let device = std::ptr::dangling::<u8>().cast();
    assert!(
        eject_resolved(
            device,
            |received| {
                assert_eq!(received, device);
                0
            },
            || panic!("no fallback after success")
        )
        .is_ok()
    );
    assert_eq!(
        eject_resolved(device, |_| -1, || panic!("no fallback after refusal")).unwrap_err(),
        "Le système a refusé l’éjection du CD."
    );
}
