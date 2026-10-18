use super::*;
#[test]
fn mounted_media_are_distinguished_from_system_volumes_and_network_shares() {
    let mac = "/dev/disk1s1 on / (apfs, local)\n/dev/disk2s1 on /Volumes/Player Card (exfat, local)\n//user@host/Music on /Volumes/Music (smbfs, nodev)\n";
    let rows = parse_mounts(mac, true);
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].path, "/Volumes/Player Card");
    assert_eq!(rows[0].kind, "volume");
    assert_eq!(rows[1].kind, "network");
    let linux = "32 21 8:1 / / rw - ext4 /dev/sda1 rw\n33 21 8:17 / /media/listener/Player\\040Card rw - vfat /dev/sdb1 rw\n34 21 0:50 / /mnt/music rw - cifs //host/music rw\n";
    let rows = parse_mounts(linux, false);
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].path, "/media/listener/Player Card");
    assert_eq!(rows[1].kind, "network");
    assert!(parse_mounts("unparseable", true).is_empty());
}
#[test]
fn windows_discovery_retains_drive_roots_and_refuses_malformed_output() {
    let rows=parse_windows(br#"[{"path":"E:\\","kind":"removable","format":"exFAT"},{"path":"Z:\\","kind":"network","format":"NTFS"}]"#).unwrap();
    assert_eq!(rows[0].path, "E:\\");
    assert_eq!(rows[1].kind, "network");
    assert!(
        parse_windows(br#"[{"path":"../private","kind":"removable","format":"exFAT"}]"#).is_err()
    );
}
