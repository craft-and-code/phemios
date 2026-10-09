use super::*;
#[test]
fn discovered_mirrors_remain_on_the_directory_authority_and_deduplicate_addresses() {
    assert_eq!(mirror_hosts(&json!([{"name":"de1.api.radio-browser.info"},{"name":"de1.api.radio-browser.info"},{"name":"nl1.api.radio-browser.info"}])).unwrap(), vec!["https://de1.api.radio-browser.info", "https://nl1.api.radio-browser.info"]);
    for host in [
        "example.org",
        "de1.api.radio-browser.info@localhost",
        "evil/de1.api.radio-browser.info",
        "nested.de1.api.radio-browser.info",
        "-de1.api.radio-browser.info",
    ] {
        assert!(mirror_hosts(&json!([{"name":host}])).is_err());
    }
    assert!(mirror_hosts(&json!([])).is_err());
}
#[test]
fn invalid_searches_and_station_ids_are_refused_without_network_access() {
    let mut directory = Directory::default();
    assert!(directory.search(&"x".repeat(257), "", "", 0, true).is_err());
    assert!(directory.search("", "", "bad\n", 0, true).is_err());
    assert!(directory.search("", "", "", 1_000_001, true).is_err());
    for uuid in [
        "",
        "../stations/search",
        "12345678-1234-1234-1234-12345678901z",
    ] {
        assert!(directory.resolve(uuid).is_err());
    }
    assert!(valid_uuid("12345678-1234-1234-1234-123456789012"));
}
