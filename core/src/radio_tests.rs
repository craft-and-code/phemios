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
#[test]
fn retired_rmc_mp3_uses_the_same_broadcaster_https_hls_without_touching_other_streams() {
    assert_eq!(
        preferred_stream("https://audio.bfmtv.com/rmcradio_128.mp3?aggregator=test"),
        "https://hls-rmc.nextradiotv.com/no_ssai/128k/media.m3u8"
    );
    for url in [
        "https://audio.bfmtv.com/other.mp3",
        "https://audio.bfmtv.com.evil.test/rmcradio_128.mp3",
        "https://other.test/rmcradio_128.mp3",
        "https://audio.bfmtv.com/rmcradio_128.mp3/extra",
    ] {
        assert_eq!(preferred_stream(url), url);
    }
}

#[test]
fn country_codes_select_the_iso_field_instead_of_translated_names() {
    assert_eq!(country_filter("US"), ("countrycode", "US".to_owned()));
    assert_eq!(country_filter("fr"), ("countrycode", "FR".to_owned()));
    assert_eq!(country_filter("Canada"), ("country", "Canada".to_owned()));
}
#[test]
fn transient_or_empty_country_mirrors_do_not_require_an_aede_login_to_recover() {
    let mut calls = 0;
    let value = retry_mirrors(&["one".into(), "two".into(), "three".into()], true, |_| {
        calls += 1;
        match calls {
            1 => Err("offline".into()),
            2 => Ok(json!([])),
            _ => Ok(json!([{"countrycode":"US"}])),
        }
    })
    .unwrap();
    assert_eq!(calls, 3);
    assert_eq!(value[0]["countrycode"], "US");
    let mut calls = 0;
    let value = retry_mirrors(&["one".into(), "two".into()], false, |_| {
        calls += 1;
        Ok(json!([]))
    })
    .unwrap();
    assert_eq!(calls, 1);
    assert_eq!(value, json!([]));
}
