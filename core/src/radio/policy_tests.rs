use super::*;
use serde_json::json;
#[test]
fn bootstrap_discovery_uses_the_next_authority_after_an_outage_or_invalid_reply() {
    for first in [
        Err("bootstrap outage".into()),
        Ok(json!({"not":"a mirror list"})),
    ] {
        let mut visited = Vec::new();
        let mut first = Some(first);
        let mirrors = discover_mirrors(|host| {
            visited.push(host.to_owned());
            first
                .take()
                .unwrap_or_else(|| Ok(json!([{"name":"test.api.radio-browser.info"}])))
        })
        .unwrap();
        assert_eq!(visited, BOOTSTRAPS);
        assert_eq!(mirrors, ["https://test.api.radio-browser.info"]);
    }
}
#[test]
fn mirror_attempts_share_one_deadline_and_cannot_replenish_the_timeout() {
    assert_eq!(
        request_timeout(Duration::ZERO).unwrap(),
        Duration::from_secs(8)
    );
    assert_eq!(
        request_timeout(Duration::from_secs(20)).unwrap(),
        Duration::from_secs(4)
    );
    assert_eq!(
        request_timeout(Duration::from_millis(23_999)).unwrap(),
        Duration::from_millis(1)
    );
    assert!(request_timeout(Duration::from_secs(24)).is_err());
    assert!(request_timeout(Duration::from_secs(25)).is_err());
}
#[test]
fn station_shape_checks_every_page_row_and_rejects_unrepresentable_numbers() {
    let station = json!({"stationuuid":"12345678-1234-1234-1234-123456789012","name":"Test","country":"France","tags":"rock","codec":"MP3","bitrate":128});
    assert_eq!(
        station_page(json!([station.clone()])).unwrap(),
        json!([station.clone()])
    );
    for field in ["stationuuid", "name", "country", "tags", "codec", "bitrate"] {
        let mut invalid = station.clone();
        invalid.as_object_mut().unwrap().remove(field);
        assert!(station_page(json!([invalid])).is_err(), "{field}");
    }
    let mut invalid = station.clone();
    invalid["bitrate"] = json!(9_007_199_254_740_992u64);
    assert!(station_page(json!([invalid])).is_err());
    let mut rows = vec![station; 51];
    rows[50] = json!(null);
    assert!(station_page(json!(rows)).is_err());
}

#[test]
fn transport_categories_never_echo_server_or_connection_details() {
    for (error, expected) in [
        (ureq::Error::StatusCode(503), "HTTP 503"),
        (ureq::Error::StatusCode(429), "HTTP 429"),
        (ureq::Error::StatusCode(500), "erreur interne"),
        (ureq::Error::StatusCode(403), "refusé"),
        (ureq::Error::HostNotFound, "introuvable"),
        (ureq::Error::Tls("untrusted secret"), "sécurisée"),
        (
            ureq::Error::Io(std::io::Error::other("untrusted secret")),
            "connexion",
        ),
    ] {
        let failure = request_failure(error);
        assert!(failure.contains(expected), "{failure}");
        assert!(!failure.contains("untrusted secret"));
    }
}

#[test]
fn interrupted_peer_connections_have_a_distinct_retry_message_from_dns_and_timeout() {
    let expected = "Radio Browser a interrompu la connexion. Réessayez plus tard.";
    for kind in [
        std::io::ErrorKind::ConnectionReset,
        std::io::ErrorKind::BrokenPipe,
        std::io::ErrorKind::UnexpectedEof,
    ] {
        assert_eq!(
            request_failure(ureq::Error::Io(std::io::Error::new(
                kind,
                "untrusted detail"
            ))),
            expected
        );
    }
    assert_ne!(request_failure(ureq::Error::HostNotFound), expected);
    assert_ne!(
        request_failure(ureq::Error::Timeout(ureq::Timeout::Global)),
        expected
    );
}
