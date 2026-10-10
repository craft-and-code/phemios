use super::*;
#[test]
fn bounds_language_and_query_before_network_access() {
    let client = Client::default();
    assert!(client.search("de", "music").is_err());
    assert!(client.search("fr", " \n ").is_err());
    assert!(client.search("fr", &"a".repeat(201)).is_err());
    assert!(client.article("en", 0).is_err());
    assert!(client.article("en", MAX_ID + 1).is_err());
    assert!(query("rock\nroll").is_err());
    assert_eq!(query("  R&B = musique  ").ok(), Some("R&B = musique"));
}
#[test]
fn retains_identity_and_plain_titles_without_injecting_snippets() {
    let result = search_result(
        &json!({"query":{"search":[{"ns":0,"pageid":42,"title":"R&B", "snippet":"<script>bad</script>"}]}}),
        "fr",
    );
    assert_eq!(
        result.ok(),
        Some(json!({"language":"fr","rows":[{"pageId":42,"title":"R&B"}]}))
    );
    assert!(search_result(&json!({"error":{"code":"maxlag"}}), "fr").is_err());
    assert!(
        search_result(
            &json!({"query":{"search":[{"ns":1,"pageid":42,"title":"Talk"}]}}),
            "fr"
        )
        .is_err()
    );
    assert!(search_result(&json!({"query":{"search":[{"ns":0,"pageid":42,"title":"A"},{"ns":0,"pageid":42,"title":"A"}]}}), "fr").is_err());
    assert!(search_result(&json!({"query":{"search":vec![json!({});21]}}), "fr").is_err());
}
#[test]
fn requires_single_matching_article_and_revision_with_bounded_nonempty_text() {
    let mut data = json!({"query":{"pages":[{"ns":0,"pageid":42,"title":"Music","extract":"Plain\n\n== History ==\nWords","lastrevid":91}]}});
    let result = article_result(&data, "en", 42, 123);
    assert_eq!(
        result.ok(),
        Some(
            json!({"language":"en","pageId":42,"revision":91,"title":"Music","text":"Plain\n\n== History ==\nWords","retrievedAt":123})
        )
    );
    assert!(article_result(&data, "en", 43, 123).is_err());
    data["query"]["pages"][0]["missing"] = json!(true);
    assert!(article_result(&data, "en", 42, 123).is_err());
    data["query"]["pages"][0]
        .as_object_mut()
        .unwrap()
        .remove("missing");
    data["query"]["pages"][0]["extract"] = json!(" ");
    assert!(article_result(&data, "en", 42, 123).is_err());
    data["query"]["pages"][0]["extract"] = json!("a".repeat(512 * 1024 + 1));
    assert!(article_result(&data, "en", 42, 123).is_err());
    data["query"]["pages"][0]["extract"] = json!("Music");
    data["query"]["pages"][0]["lastrevid"] = json!(0);
    assert!(article_result(&data, "en", 42, 123).is_err());
}
