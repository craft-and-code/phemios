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

#[path = "radio_test_support.rs"]
mod support;

#[test]
fn malformed_station_mirror_is_skipped_before_the_result_is_exposed() {
    let fixture = support::Fixture::new(json!({"stations":[]}), json!([]), 200);
    let mut directory = fixture.directory();
    assert_eq!(
        directory.search("jazz", "US", "", 0, true).unwrap(),
        json!([])
    );
    assert_eq!(fixture.paths().len(), 2);
}

#[test]
fn malformed_statistics_mirror_is_skipped_before_count_is_exposed() {
    let fixture = support::Fixture::new(json!({"stations":"many"}), json!({"stations":42}), 200);
    let mut directory = fixture.directory();
    assert_eq!(directory.statistics().unwrap()["stations"], 42);
    assert_eq!(fixture.paths().len(), 2);
}

#[test]
fn a_mismatched_station_resolution_retries_without_exposing_the_other_station() {
    let uuid = "12345678-1234-1234-1234-123456789012";
    let fixture = support::Fixture::new(
        json!({"ok":true,"stationuuid":"87654321-1234-1234-1234-123456789012","url":"https://wrong.test/live"}),
        json!({"ok":true,"stationuuid":uuid,"url":"https://station.test/live"}),
        200,
    );
    let mut directory = fixture.directory();
    assert_eq!(
        directory.resolve(uuid).unwrap()["url"],
        "https://station.test/live"
    );
    assert_eq!(fixture.paths().len(), 2);
}

#[test]
fn provider_outages_report_the_http_category_without_server_controlled_text() {
    let fixture = support::Fixture::new(json!("untrusted detail"), json!("untrusted detail"), 503);
    let mut directory = fixture.directory();
    let failure = directory.search("", "US", "", 0, true).unwrap_err();
    assert!(failure.contains("HTTP 503"), "{failure}");
    assert!(!failure.contains("untrusted detail"));
    assert_eq!(fixture.paths().len(), 2);
}

#[test]
fn production_directory_cannot_contact_a_private_mirror_address() {
    let fixture = support::Fixture::new(json!([]), json!([]), 200);
    let directory = Directory::default();
    assert!(
        directory
            .read(Instant::now(), &fixture.host(), "/json/servers", &[])
            .is_err()
    );
    assert!(fixture.paths().is_empty());
}
