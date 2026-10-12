use super::*;
use crate::private_store_test_support as support;
use std::fs;
use std::sync::atomic::{AtomicU64, Ordering};
struct Sandbox(PathBuf);
impl Sandbox {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        Self(std::env::temp_dir().join(format!(
            "phemios-private-articles-{}-{}",
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
fn article() -> Value {
    json!({"language":"fr","pageId":1,"revision":2,"retrievedAt":3,"title":"Private article","text":"Retained text\nwith lines"})
}
#[test]
fn article_utf16_title_and_date_bounds_match_frontend_without_replacing_bytes() {
    let (client, _) = support::sessions();
    let root = Sandbox::new();
    let store = Store::new(root.0.clone());
    let mut value = article();
    for title in ["x".repeat(2048), "📚".repeat(1024)] {
        value["title"] = title.into();
        value["retrievedAt"] = json!(8_640_000_000_000_000_u64);
        store
            .update(Source::Server, &client, "save", &value)
            .unwrap();
    }
    let path = store
        .document
        .path(&private_documents::owner(Source::Server, &client).unwrap());
    let before = fs::read(&path).unwrap();
    let mut refused = Vec::new();
    for title in ["x".repeat(2049), "📚".repeat(1025)] {
        value["title"] = title.into();
        refused.push(
            store
                .update(Source::Server, &client, "save", &value)
                .is_err(),
        );
    }
    value = article();
    value["retrievedAt"] = json!(8_640_000_000_000_001_u64);
    refused.push(
        store
            .update(Source::Server, &client, "save", &value)
            .is_err(),
    );
    assert_eq!(refused, vec![true; 3]);
    assert_eq!(fs::read(path).unwrap(), before);
}
#[test]
fn retained_articles_are_account_source_and_authority_private_and_auditors_cannot_write() {
    let clients = support::clients(&[("alice", "user"), ("bob", "user"), ("auditor", "auditor")]);
    let other = support::clients(&[("alice", "user")]);
    let root = Sandbox::new();
    let store = Store::new(root.0.clone());
    store
        .update(Source::Server, &clients[0], "save", &article())
        .unwrap();
    for client in [&clients[1], &other[0]] {
        assert_eq!(
            store.read(Source::Server, client).unwrap()["articles"],
            json!([])
        );
    }
    assert_eq!(
        store.read(Source::Local, &clients[0]).unwrap()["articles"],
        json!([])
    );
    for action in ["save", "remove"] {
        assert!(
            store
                .update(Source::Server, &clients[2], action, &article())
                .is_err()
        );
    }
    let mut changed = article();
    changed["text"] = "Updated".into();
    store
        .update(Source::Server, &clients[0], "save", &changed)
        .unwrap();
    assert_eq!(
        store.read(Source::Server, &clients[0]).unwrap()["articles"],
        json!([changed])
    );
}
#[test]
fn foreign_wrappers_corruption_and_invalid_payloads_are_preserved() {
    let (client, _) = support::sessions();
    let root = Sandbox::new();
    let store = Store::new(root.0.clone());
    store
        .update(Source::Server, &client, "save", &article())
        .unwrap();
    let owner = private_documents::owner(Source::Server, &client).unwrap();
    let path = store.document.path(&owner);
    let mut doc: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    doc["owner"] = json!(["server", "https://foreign.example", "other"]);
    fs::write(&path, doc.to_string()).unwrap();
    let before = fs::read(&path).unwrap();
    assert!(
        store
            .update(Source::Server, &client, "remove", &article())
            .is_err()
    );
    assert_eq!(fs::read(&path).unwrap(), before);
    fs::write(&path, b"broken JSON").unwrap();
    assert!(
        store
            .update(Source::Server, &client, "save", &article())
            .is_err()
    );
    assert_eq!(fs::read(&path).unwrap(), b"broken JSON");
    fs::remove_file(&path).unwrap();
    store
        .update(Source::Server, &client, "save", &article())
        .unwrap();
    let before = fs::read(&path).unwrap();
    for change in [
        json!({"text":"bad\u{0}"}),
        json!({"pageId":0}),
        json!({"text":"x".repeat(512*1024+1)}),
        json!({"language":"../owner"}),
    ] {
        let mut invalid = article();
        for (k, v) in change.as_object().unwrap() {
            invalid[k] = v.clone();
        }
        assert!(
            store
                .update(Source::Server, &client, "save", &invalid)
                .is_err()
        );
        assert_eq!(fs::read(&path).unwrap(), before);
    }
}
#[test]
fn capacity_refuses_without_eviction_and_remove_preserves_other_identities() {
    let (client, _) = support::sessions();
    let root = Sandbox::new();
    let store = Store::new(root.0.clone());
    for id in 1..=40 {
        let mut value = article();
        value["pageId"] = id.into();
        store
            .update(Source::Server, &client, "save", &value)
            .unwrap();
    }
    let before = store.read(Source::Server, &client).unwrap();
    let mut extra = article();
    extra["pageId"] = 41.into();
    assert!(
        store
            .update(Source::Server, &client, "save", &extra)
            .is_err()
    );
    assert_eq!(store.read(Source::Server, &client).unwrap(), before);
    store
        .update(Source::Server, &client, "remove", &article())
        .unwrap();
    assert_eq!(
        store.read(Source::Server, &client).unwrap()["articles"]
            .as_array()
            .unwrap()
            .len(),
        39
    );
}
