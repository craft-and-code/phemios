use super::*;
use serde_json::json;
#[test]
fn apple_episode_uses_show_id_and_fixed_lookup_endpoint() {
    assert_eq!(
        lookup_address(
            "https://podcasts.apple.com/fr/podcast/sortie-de-veille/id1678105148?i=1000797892417"
        )
        .unwrap(),
        (
            1678105148,
            "https://itunes.apple.com/lookup?id=1678105148&entity=podcast&country=fr".into()
        )
    );
    assert!(lookup_address("https://podcasts.apple.com/podcast/id123").is_ok());
}
#[test]
fn apple_links_reject_other_hosts_credentials_and_malformed_ids() {
    for input in [
        "http://podcasts.apple.com/podcast/id123",
        "https://podcasts.apple.com.evil.org/podcast/id123",
        "https://u:p@podcasts.apple.com/podcast/id123",
        "https://podcasts.apple.com:8080/podcast/id123",
        "https://podcasts.apple.com/podcast/id0",
        "https://podcasts.apple.com/podcast/id123x",
        "https://podcasts.apple.com/music/id123",
        "https://podcasts.apple.com/podcast/id123#frag",
        "https://podcasts.apple.com/podcast/id18446744073709551616",
    ] {
        assert!(lookup_address(input).is_err(), "{input}");
    }
}
#[test]
fn lookup_requires_exact_podcast_identity_and_public_rss() {
    let row = json!({"kind":"podcast", "collectionId":123, "trackId":123, "feedUrl":"https://feeds.example.org/show.xml"});
    let encode = |rows| serde_json::to_vec(&json!({"results": rows})).unwrap();
    assert_eq!(
        resolved_feed(&encode(vec![row.clone()]), 123).unwrap(),
        "https://feeds.example.org/show.xml"
    );
    assert!(resolved_feed(&encode(vec![row.clone()]), 456).is_err());
    assert!(resolved_feed(&encode(vec![row.clone(), row.clone()]), 123).is_err());
    for feed in [
        "file:///private/feed",
        "http://127.0.0.1/feed",
        "https://user:pass@example.org/feed",
    ] {
        let mut changed = row.clone();
        changed["feedUrl"] = json!(feed);
        assert!(resolved_feed(&encode(vec![changed]), 123).is_err());
    }
    for field in ["kind", "trackId", "collectionId", "feedUrl"] {
        let mut changed = row.clone();
        changed.as_object_mut().unwrap().remove(field);
        assert!(resolved_feed(&encode(vec![changed]), 123).is_err());
    }
    for data in [b"{}".as_slice(), b"invalid", b"{\"results\":[]}"] {
        assert!(resolved_feed(data, 123).is_err());
    }
}
