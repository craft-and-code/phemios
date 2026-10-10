use super::*;
#[test]
fn malformed_denied_unexpected_or_oversized_frames_are_refused() {
    for data in [
        "<Play result=\"Error\"/>",
        "<Stop result=\"OK\"/>",
        "<Play result=\"OK\"><broken>",
        "<!DOCTYPE Play [<!ENTITY x SYSTEM \"file:///private\">]><Play result=\"OK\"/>",
        "<Play result=\"OK\" result=\"OK\"/>",
    ] {
        assert!(read_reply(data.as_bytes(), "Play", true).is_err(), "{data}");
    }
    let huge = format!("<Play result=\"OK\" message=\"{}\"/>", "x".repeat(65536));
    assert!(read_reply(huge.as_bytes(), "Play", true).is_err());
}
#[test]
fn local_network_and_metadata_identity_are_explicit() {
    for address in ["127.0.0.1", "192.168.1.3", "10.0.0.1", "::1", "fd00::1"] {
        assert!(private(address.parse().unwrap()));
    }
    for address in ["8.8.8.8", "0.0.0.0", "224.0.0.1", "2606:4700:4700::1111"] {
        assert!(!private(address.parse().unwrap()));
    }
    let a=read_reply(b"<?xml version=\"1.0\"?><Status state=\"2\"><metadata uri=\"file:///music/a%20b.flac\"/></Status>".as_slice(),"Status",false).unwrap();
    assert_eq!(a["metadata.uri"], "file:///music/a%20b.flac");
}
