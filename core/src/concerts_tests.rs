use super::*;
fn event(name: &str, id: &str) -> Value {
    json!({"id":"event-one","name":"Example Live","url":"https://www.ticketmaster.fr/event-one",
 "dates":{"start":{"localDate":"2027-05-02","localTime":"20:00:00"},"timezone":"Europe/Paris","status":{"code":"onsale"}},
 "_embedded":{"attractions":[{"id":id,"name":name}],"venues":[{"name":"Example Hall","city":{"name":"Paris"},"country":{"name":"France","countryCode":"FR"}}]}})
}
#[test]
fn exact_performer_matches_exclude_names_only_mentioned_in_event_titles() {
    let value = json!({"page":{"number":0,"totalPages":1},"_embedded":{"events":[event("Example Artist","one"),event("Example Tribute","two")]}});
    let result = project(&value, "example artist", 0).unwrap();
    assert_eq!(result["items"].as_array().unwrap().len(), 1);
    assert_eq!(result["items"][0]["venue"], "Example Hall");
    assert_eq!(result["items"][0]["country"], "France");
    assert_eq!(result["source"], "Ticketmaster Discovery");
}
#[test]
fn ambiguous_provider_identities_and_unexpected_pages_are_refused() {
    let value = json!({"page":{"number":0,"totalPages":1},"_embedded":{"events":[event("Example Artist","one"),event("Example Artist","two")]}});
    assert!(project(&value, "example artist", 0).is_err());
    assert!(project(&value, "example artist", 1).is_err());
    assert!(project(&json!({}), "example artist", 0).is_err());
}
#[test]
fn unsupported_links_are_not_forwarded_and_undated_events_remain_explicit() {
    let mut row = event("Example Artist", "one");
    row["url"] = json!("javascript:alert(1)");
    row["dates"]["start"] = json!({"dateTBA":true});
    let result = project(
        &json!({"page":{"number":0,"totalPages":1},"_embedded":{"events":[row]}}),
        "example artist",
        0,
    )
    .unwrap();
    assert_eq!(result["items"][0]["url"], Value::Null);
    assert_eq!(result["items"][0]["date"], Value::Null);
}
#[test]
fn configuration_and_queries_reject_invalid_keys_and_bounds_without_network() {
    let mut client = Directory::default();
    for key in ["", "secret?key", "line\nsecret"] {
        assert!(client.events(key, "Example Artist", 0).is_err());
    }
    assert!(client.events("abcdefghijklmnop", "", 0).is_err());
    assert!(
        client
            .events("abcdefghijklmnop", "Example Artist", 10)
            .is_err()
    );
}
