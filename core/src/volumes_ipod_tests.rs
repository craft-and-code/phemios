use super::*;
use serde_json::json;
#[test]
fn associates_each_model_with_its_exact_disk_instead_of_the_first_ipod() {
    let tree = json!([
        {"idVendor":1452,"idProduct":4705,"IORegistryEntryChildren":[{"BSD Name":"disk3s1"}]},
        {"idVendor":1452,"idProduct":4711,"IORegistryEntryChildren":[{"IORegistryEntryChildren":[{"BSD Name":"disk8s1"}]}]}
    ]);
    assert_eq!(identify(&tree, "disk3s1").unwrap().name, "iPod classic");
    let nano = identify(&tree, "disk8s1").unwrap();
    assert_eq!(nano.name, "iPod nano 7G");
    assert_eq!(nano.icon, "ipod-touch");
    assert!(!nano.supported);
    assert!(identify(&tree, "disk9s1").is_none());
}
#[test]
fn unknown_vendors_models_and_ambiguous_disks_do_not_invent_an_identity() {
    for tree in [
        json!([{"idVendor":1,"idProduct":4711,"BSD Name":"disk8s1"}]),
        json!([{"idVendor":1452,"idProduct":1,"BSD Name":"disk8s1"}]),
        json!([{"idVendor":1452,"idProduct":4711,"BSD Name":"disk8s1"},{"idVendor":1452,"idProduct":4705,"BSD Name":"disk8s1"}]),
    ] {
        assert!(identify(&tree, "disk8s1").is_none());
    }
    assert!(!model(0x1266).unwrap().supported);
    assert!(!model(0x1302).unwrap().supported);
    assert!(!model(0x1303).unwrap().supported);
    assert!(model(0x1265).unwrap().supported);
}
