use super::*;
fn toc() -> Vec<u32> {
    vec![1, 2, 30_150, 150, 15_150]
}
fn release() -> Value {
    json!({"title":"Night Signals","artist-credit":[{"name":"Synthetic Ensemble","joinphrase":""}],
    "media":[{"discs":[{"sectors":30150,"offsets":[150,15150]}],
    "tracks":[{"position":1,"title":"Opening"},{"position":2,"title":"Finale","artist-credit":[{"name":"Guest"}]}]}]})
}
#[test]
fn complete_exact_toc_identifies_all_tracks_and_credits() {
    let result = parse::result(&json!({"releases":[release()]}), &toc()).unwrap();
    assert_eq!(result["status"], "matched");
    assert_eq!(result["tracks"][0]["artist"], "Synthetic Ensemble");
    assert_eq!(result["tracks"][1]["artist"], "Guest");
}
#[test]
fn fuzzy_and_unrelated_media_never_supply_automatic_names() {
    let mut row = release();
    row["media"][0]["discs"][0]["offsets"][1] = json!(15151);
    assert_eq!(
        parse::result(&json!({"releases":[row]}), &toc()).unwrap()["status"],
        "not_found"
    );
    let mut row = release();
    row["media"][0]["discs"][0]["sectors"] = json!(30151);
    assert_eq!(
        parse::result(&json!({"releases":[row]}), &toc()).unwrap()["status"],
        "not_found"
    );
}
#[test]
fn conflicting_editions_are_explicit_and_equivalent_editions_coalesce() {
    assert_eq!(
        parse::result(&json!({"releases":[release(),release()]}), &toc()).unwrap()["status"],
        "matched"
    );
    let mut other = release();
    other["media"][0]["tracks"][1]["title"] = json!("Different programme");
    assert_eq!(
        parse::result(&json!({"releases":[release(),other]}), &toc()).unwrap()["status"],
        "ambiguous"
    );
}
#[test]
fn incomplete_reordered_and_hostile_text_are_rejected() {
    for mode in 0..5 {
        let mut row = release();
        match mode {
            0 => row["media"][0]["tracks"][1]["position"] = json!(1),
            1 => row["media"][0]["tracks"] = json!([]),
            2 => row["media"][0]["tracks"][0]["title"] = json!("Bad\nname"),
            3 => row["title"] = json!("x".repeat(1001)),
            _ => row["artist-credit"] = Value::Null,
        }
        assert!(
            parse::result(&json!({"releases":[row]}), &toc()).is_err(),
            "mode {mode}"
        );
    }
    assert!(parse::result(&json!({"releases":[release()],"release-count":2}), &toc()).is_err());
}
#[test]
fn bounded_cache_has_separate_success_failure_and_miss_expiries() {
    let mut client = Client::default();
    let now = Instant::now();
    client.retain(&toc(), Ok(json!({"status":"matched"})), now);
    assert!(
        client
            .cached(&toc(), now + Duration::from_secs(86399))
            .is_some()
    );
    assert!(
        client
            .cached(&toc(), now + Duration::from_secs(86400))
            .is_none()
    );
    client.retain(&toc(), Err("offline".into()), now);
    assert!(
        client
            .cached(&toc(), now + Duration::from_secs(29))
            .unwrap()
            .is_err()
    );
    assert!(
        client
            .cached(&toc(), now + Duration::from_secs(30))
            .is_none()
    );
    client.retain(&toc(), Ok(json!({"status":"not_found"})), now);
    assert!(
        client
            .cached(&toc(), now + Duration::from_secs(1800))
            .is_none()
    );
    for i in 0..40 {
        client.retain(&[1, 1, 1000 + i, 150], Ok(Value::Null), now);
    }
    assert_eq!(client.entries.len(), 32);
    assert!(client.cached(&toc(), now).is_none());
}
#[test]
fn malformed_tables_fail_before_http_or_waiting() {
    let mut client = Client::default();
    for toc in [
        vec![],
        vec![1, 0, 100, 150],
        vec![1, 2, 1000, 150],
        vec![1, 2, 1000, 500, 150],
        vec![1, 1, 540151, 150],
        vec![1, 1, 1000, 1000],
    ] {
        assert!(client.identify(&toc).is_err());
    }
}
