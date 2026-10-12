use super::*;
use crate::private_store_test_support as support;
use std::sync::atomic::{AtomicU64, Ordering};
struct Sandbox(PathBuf);
impl Sandbox {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        Self(std::env::temp_dir().join(format!(
            "phemios-private-podcasts-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        )))
    }
}
impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn feed() -> Value {
    json!({"url":"https://example.org/feed.xml","title":"Private feed","author":"Fixture","episodes":[]})
}
#[test]
fn utf16_text_limits_match_frontend_and_refusals_preserve_retained_bytes() {
    let (client, _) = support::sessions();
    let sandbox = Sandbox::new();
    let store = Store::new(sandbox.0.clone());
    for title in ["x".repeat(512), "🎧".repeat(256)] {
        let mut value = feed();
        value["title"] = title.into();
        store
            .update(Source::Server, &client, "save", &value)
            .unwrap();
    }
    for id in ["x".repeat(4096), "🎧".repeat(2048)] {
        store
            .update(
                Source::Server,
                &client,
                "mark",
                &json!({"feed":feed()["url"],"id":id}),
            )
            .unwrap();
    }
    let path = store.path(&Store::owner(Source::Server, &client).unwrap());
    let before = fs::read(&path).unwrap();
    let mut refused = Vec::new();
    for title in ["x".repeat(513), "🎧".repeat(257)] {
        let mut value = feed();
        value["title"] = title.into();
        refused.push(
            store
                .update(Source::Server, &client, "save", &value)
                .is_err(),
        );
    }
    for id in ["x".repeat(4097), "🎧".repeat(2049)] {
        refused.push(
            store
                .update(
                    Source::Server,
                    &client,
                    "mark",
                    &json!({"feed":feed()["url"],"id":id}),
                )
                .is_err(),
        );
    }
    assert_eq!(refused, vec![true; 4]);
    assert_eq!(fs::read(&path).unwrap(), before);
}
#[test]
fn invalid_podcast_dates_cannot_make_retained_feed_unreadable() {
    let (client, _) = support::sessions();
    let sandbox = Sandbox::new();
    let store = Store::new(sandbox.0.clone());
    let mut value = feed();
    value["episodes"] = json!([{"id":"fixture","title":"Episode","url":"https://example.org/episode.mp3","summary":"","duration":null,"date":"2024-02-29T12:34:56.789Z"}]);
    for date in [
        json!(null),
        json!("2024-02-29T12:34:56.789Z"),
        json!("+010000-01-01T00:00:00.000Z"),
        json!("-000001-01-01T00:00:00.000Z"),
        json!("-271821-04-20T00:00:00.000Z"),
        json!("+275760-09-13T00:00:00.000Z"),
    ] {
        value["episodes"][0]["date"] = date;
        store
            .update(Source::Server, &client, "save", &value)
            .unwrap();
    }
    let path = store.path(&Store::owner(Source::Server, &client).unwrap());
    let before = fs::read(&path).unwrap();
    let mut refused = Vec::new();
    for date in [
        "not a date",
        "2023-02-29T12:34:56.789Z",
        "2024-04-31T12:34:56.789Z",
        "2024-13-01T00:00:00.000Z",
        "2024-01-01T24:00:00.000Z",
        "2024-01-01T00:60:00.000Z",
        "2024-01-01T00:00:60.000Z",
        "+275760-09-13T00:00:00.001Z",
        "-271821-04-19T23:59:59.999Z",
        "+009999-01-01T00:00:00.000Z",
        "-000000-01-01T00:00:00.000Z",
        "-+00001-01-01T00:00:00.000Z",
        "+-00001-01-01T00:00:00.000Z",
    ] {
        value["episodes"][0]["date"] = date.into();
        refused.push(
            store
                .update(Source::Server, &client, "save", &value)
                .is_err(),
        );
    }
    assert_eq!(refused, vec![true; 13]);
    assert_eq!(fs::read(path).unwrap(), before);
}
#[test]
fn source_and_authority_partitions_never_reveal_or_overwrite_each_other() {
    let (client, _) = support::sessions();
    let sandbox = Sandbox::new();
    let store = Store::new(sandbox.0.clone());
    store
        .update(Source::Server, &client, "save", &feed())
        .unwrap();
    assert_eq!(
        store.read(Source::Local, &client).unwrap()["feeds"],
        json!([])
    );
    store
        .update(
            Source::Local,
            &client,
            "mark",
            &json!({"feed":"https://example.org/feed.xml","id":"episode"}),
        )
        .unwrap();
    assert_eq!(
        store.read(Source::Server, &client).unwrap()["feeds"],
        json!([feed()])
    );
    assert_eq!(
        store.read(Source::Server, &client).unwrap()["episodes"],
        json!([])
    );
}
#[test]
fn retained_foreign_identity_and_corrupt_files_are_refused_without_mutation() {
    let (client, _) = support::sessions();
    let sandbox = Sandbox::new();
    let store = Store::new(sandbox.0.clone());
    store
        .update(Source::Server, &client, "save", &feed())
        .unwrap();
    let path = store.path(&Store::owner(Source::Server, &client).unwrap());
    let mut value: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    value["owner"] = json!(["server", "https://foreign.example", "foreign"]);
    fs::write(&path, value.to_string()).unwrap();
    let before = fs::read(&path).unwrap();
    assert!(store.read(Source::Server, &client).is_err());
    assert!(
        store
            .update(Source::Server, &client, "remove", &feed()["url"])
            .is_err()
    );
    assert_eq!(fs::read(&path).unwrap(), before);
    fs::write(&path, b"broken JSON").unwrap();
    assert!(
        store
            .update(Source::Server, &client, "save", &feed())
            .is_err()
    );
    assert_eq!(fs::read(&path).unwrap(), b"broken JSON");
}
#[test]
fn narrow_actions_keep_unrelated_data_and_unknown_retained_fields() {
    let (client, _) = support::sessions();
    let sandbox = Sandbox::new();
    let store = Store::new(sandbox.0.clone());
    store
        .update(Source::Server, &client, "save", &feed())
        .unwrap();
    let path = store.path(&Store::owner(Source::Server, &client).unwrap());
    let mut value: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    value["future"] = json!({"keep":true});
    fs::write(&path, value.to_string()).unwrap();
    let marker = json!({"feed":"https://example.org/feed.xml","id":"episode"});
    store
        .update(Source::Server, &client, "mark", &marker)
        .unwrap();
    store
        .update(Source::Server, &client, "mark", &marker)
        .unwrap();
    let state = store
        .update(Source::Server, &client, "remove", &feed()["url"])
        .unwrap();
    assert_eq!(state["episodes"], json!([marker]));
    assert_eq!(state["feeds"], json!([]));
    let value: Value = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
    assert_eq!(value["future"], json!({"keep":true}));
    assert!(
        store
            .update(Source::Server, &client, "../other", &feed())
            .is_err()
    );
}

#[test]
fn accounts_and_authorities_are_distinct_while_local_identity_survives_a_new_port() {
    let clients = support::clients(&[("alice", "user"), ("bob", "user"), ("audit", "auditor")]);
    let remote = support::clients(&[("alice", "user")]);
    let sandbox = Sandbox::new();
    let store = Store::new(sandbox.0.clone());
    store
        .update(Source::Server, &clients[0], "save", &feed())
        .unwrap();
    assert_eq!(
        store.read(Source::Server, &clients[1]).unwrap()["feeds"],
        json!([])
    );
    assert_eq!(
        store.read(Source::Server, &remote[0]).unwrap()["feeds"],
        json!([])
    );
    let snapshot = store.read(Source::Server, &clients[2]).unwrap();
    for action in ["save", "remove", "mark"] {
        assert!(
            store
                .update(Source::Server, &clients[2], action, &feed())
                .is_err()
        );
    }
    assert_eq!(store.read(Source::Server, &clients[2]).unwrap(), snapshot);
    store
        .update(Source::Local, &clients[0], "save", &feed())
        .unwrap();
    assert_eq!(
        store.read(Source::Local, &remote[0]).unwrap()["feeds"],
        json!([feed()])
    );
}

#[cfg(unix)]
#[test]
fn private_roots_files_and_retained_targets_are_never_repaired_or_followed() {
    use std::os::unix::fs::{PermissionsExt, symlink};
    let (client, _) = support::sessions();
    let sandbox = Sandbox::new();
    let store = Store::new(sandbox.0.clone());
    store
        .update(Source::Server, &client, "save", &feed())
        .unwrap();
    let path = store.path(&Store::owner(Source::Server, &client).unwrap());
    let original = fs::read(&path).unwrap();
    assert_eq!(
        fs::metadata(&sandbox.0).unwrap().permissions().mode() & 0o777,
        0o700
    );
    assert_eq!(
        fs::metadata(&path).unwrap().permissions().mode() & 0o777,
        0o600
    );
    fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
    assert!(store.read(Source::Server, &client).is_err());
    assert!(
        store
            .update(Source::Server, &client, "save", &feed())
            .is_err()
    );
    assert_eq!(fs::read(&path).unwrap(), original);
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
    fs::set_permissions(&sandbox.0, fs::Permissions::from_mode(0o777)).unwrap();
    assert!(
        store
            .update(Source::Server, &client, "save", &feed())
            .is_err()
    );
    assert_eq!(
        fs::metadata(&sandbox.0).unwrap().permissions().mode() & 0o777,
        0o777
    );
    fs::set_permissions(&sandbox.0, fs::Permissions::from_mode(0o700)).unwrap();
    let alias = Sandbox::new();
    symlink(&sandbox.0, &alias.0).unwrap();
    assert!(
        Store::new(alias.0.clone())
            .read(Source::Server, &client)
            .is_err()
    );
    fs::remove_file(&alias.0).unwrap();
    let outside = sandbox.0.join("untouched.json");
    fs::write(&outside, &original).unwrap();
    fs::remove_file(&path).unwrap();
    symlink(&outside, &path).unwrap();
    assert!(
        store
            .update(Source::Server, &client, "save", &feed())
            .is_err()
    );
    assert_eq!(fs::read(&outside).unwrap(), original);
}

#[test]
fn native_input_and_retained_document_bounds_refuse_without_partial_updates() {
    let (client, _) = support::sessions();
    let sandbox = Sandbox::new();
    let store = Store::new(sandbox.0.clone());
    store
        .update(Source::Server, &client, "save", &feed())
        .unwrap();
    let path = store.path(&Store::owner(Source::Server, &client).unwrap());
    let before = fs::read(&path).unwrap();
    let mut oversized = feed();
    oversized["episodes"] = json!(vec![json!({}); 201]);
    for payload in [
        oversized,
        json!({"url":"file:///private/fixture"}),
        json!({"owner":["other"],"path":"../../other"}),
    ] {
        assert!(
            store
                .update(Source::Server, &client, "save", &payload)
                .is_err()
        );
        assert_eq!(fs::read(&path).unwrap(), before);
    }
    let mut document: Value = serde_json::from_slice(&before).unwrap();
    document["episodes"] = json!(vec![
        json!({"feed":"https://example.org/feed.xml","id":"one"});
        4097
    ]);
    fs::write(&path, document.to_string()).unwrap();
    let retained = fs::read(&path).unwrap();
    assert!(
        store
            .update(Source::Server, &client, "remove", &feed()["url"])
            .is_err()
    );
    assert_eq!(fs::read(&path).unwrap(), retained);
    fs::write(&path, vec![b' '; MAX_BYTES + 1]).unwrap();
    assert!(store.read(Source::Server, &client).is_err());
}

#[test]
fn foreign_namespace_for_the_same_owner_is_refused_without_rewriting_any_bytes() {
    let (client, _) = support::sessions();
    let sandbox = Sandbox::new();
    let store = Store::new(sandbox.0.clone());
    store
        .update(Source::Server, &client, "save", &feed())
        .unwrap();
    let path = store.path(&Store::owner(Source::Server, &client).unwrap());
    let mut value: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    value["namespace"] = "articles".into();
    fs::write(&path, value.to_string()).unwrap();
    let before = fs::read(&path).unwrap();
    assert!(store.read(Source::Server, &client).is_err());
    for action in ["save", "remove", "mark"] {
        assert!(
            store
                .update(Source::Server, &client, action, &feed())
                .is_err()
        );
        assert_eq!(fs::read(&path).unwrap(), before);
    }
}
