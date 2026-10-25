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
