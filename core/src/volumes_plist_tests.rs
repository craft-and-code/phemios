use super::*;
#[test]
fn parses_real_os_shapes_and_decodes_names_without_following_external_dtd() {
    let value = parse(br#"<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Internal</key><false/><key>BusProtocol</key><string>USB</string><key>name</key><string>A &amp; B</string><key>devices</key><array><dict><key>idProduct</key><integer>4711</integer></dict></array><key>ignored</key><data>AA==</data></dict></plist>"#).unwrap();
    assert_eq!(value["name"], "A & B");
    assert_eq!(value["Internal"], false);
    assert_eq!(value["devices"][0]["idProduct"], 4711);
    assert!(value["ignored"].is_null());
    assert_eq!(
        parse(b"<dict><key>signed</key><integer>-1</integer></dict>").unwrap()["signed"],
        -1
    );
}
#[test]
fn refuses_unbounded_duplicate_and_malformed_device_metadata() {
    for bytes in [
        b"<plist><dict><key>x</key></dict></plist>".as_slice(),
        b"<plist><dict><key>x</key><true/><key>x</key><false/></dict></plist>",
        b"<plist><dict><key>x</key><integer>bad</integer></dict></plist>",
    ] {
        assert!(parse(bytes).is_err());
    }
    assert!(parse(&vec![b'x'; 262145]).is_err());
    let nested = format!(
        "<plist>{}{}{}</plist>",
        "<array>".repeat(40),
        "<string>no</string>",
        "</array>".repeat(40)
    );
    assert!(parse(nested.as_bytes()).is_err());
}

#[test]
fn mac_discovery_excludes_recovery_volumes_and_disk_images_using_os_metadata() {
    use serde_json::json;
    assert!(!external(&json!({"Internal":true,"BusProtocol":"Apple Fabric"})).unwrap());
    assert!(!external(&json!({"Internal":false,"BusProtocol":"Disk Image"})).unwrap());
    assert!(external(&parse(b"<dict><key>Internal</key>\n<false/><key>BusProtocol</key><string>USB</string></dict>").unwrap()).unwrap());
    assert!(external(&json!({"Internal":"false","BusProtocol":"USB"})).is_err());
}
