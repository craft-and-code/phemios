use super::*;
use serde_json::json;
#[test]
fn ejection_refuses_replacement_internal_unmounted_and_non_ejectable_devices() {
    let mut volume = super::super::volume("/Volumes/Example", "exfat", "volume");
    volume.device = Some("disk8s1".into());
    volume.ejectable = true;
    let info = json!({"Internal":false,"BusProtocol":"USB","Ejectable":true,"MountPoint":"/Volumes/Example","DeviceIdentifier":"disk8s1"});
    assert_eq!(eject_id(&volume, &info).unwrap(), "/dev/disk8s1");
    for (key, value) in [
        ("Internal", json!(true)),
        ("Ejectable", json!(false)),
        ("BusProtocol", json!("Disk Image")),
        ("MountPoint", json!("/Volumes/Other")),
        ("DeviceIdentifier", json!("disk9s1")),
        ("DeviceIdentifier", json!("disk8s1;rm")),
    ] {
        let mut changed = info.clone();
        changed[key] = value;
        assert!(eject_id(&volume, &changed).is_err());
    }
    volume.ejectable = false;
    assert!(eject_id(&volume, &info).is_err());
}
