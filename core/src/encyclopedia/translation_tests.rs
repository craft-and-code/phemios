use super::*;
use serde_json::json;
#[test]
fn follows_only_a_matching_source_identity_and_selected_language_link() {
    let mut value = json!({"query":{"pages":[{"pageid":42,"ns":0,"langlinks":[{"lang":"en","title":"Different title","url":"https://untrusted.invalid/ignored"}]}]}});
    assert_eq!(
        counterpart_title(&value, 42, "en").unwrap(),
        "Different title"
    );
    assert!(counterpart_title(&value, 43, "en").is_err());
    assert!(counterpart_title(&value, 42, "fr").is_err());
    for title in ["A|B", "A#Section", "bad\nquery", " "] {
        value["query"]["pages"][0]["langlinks"][0]["title"] = json!(title);
        assert!(counterpart_title(&value, 42, "en").is_err());
    }
    value["query"]["pages"][0]["langlinks"] = json!([]);
    assert_eq!(counterpart_title(&value, 42, "en").unwrap_err(), MISSING);
    value["query"]["pages"][0]
        .as_object_mut()
        .unwrap()
        .remove("langlinks");
    assert_eq!(counterpart_title(&value, 42, "en").unwrap_err(), MISSING);
    value["query"]["pages"][0]["ns"] = json!(1);
    assert!(counterpart_title(&value, 42, "en").is_err());
    assert!(counterpart_title(&json!({"error":{}}), 42, "en").is_err());
}
#[test]
fn accepts_the_counterparts_own_identity_and_provenance_but_never_missing_or_multi_page_answers() {
    let mut value = json!({"query":{"pages":[{"pageid":71,"ns":0,"title":"Counterpart","extract":"Fictional text","lastrevid":123}]}});
    let article = counterpart_result(&value, "en", 456).unwrap();
    assert_eq!(article["pageId"], 71);
    assert_eq!(article["language"], "en");
    assert_eq!(article["revision"], 123);
    assert_eq!(article["retrievedAt"], 456);
    value["query"]["pages"][0]["missing"] = json!(true);
    assert!(counterpart_result(&value, "en", 456).is_err());
    assert!(counterpart_result(&json!({"query":{"pages":[]}}), "en", 456).is_err());
    value["query"]["pages"]
        .as_array_mut()
        .unwrap()
        .push(json!({}));
    assert!(counterpart_result(&value, "en", 456).is_err());
    let client = Client::default();
    assert!(client.translated_article("fr", 0, "en").is_err());
    assert!(client.translated_article("de", 42, "en").is_err());
    assert!(client.translated_article("fr", 42, "de").is_err());
}
