use super::*;
use crate::{
    article_store, federation::Source, podcast_store, private_store_test_support as support,
};
use serde_json::{Value, json};
use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};
struct Sandbox(PathBuf);
impl Sandbox {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        Self(std::env::temp_dir().join(format!(
            "phemios-private-backup-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        )))
    }
    fn stores(&self) -> (podcast_store::Store, article_store::Store) {
        (
            podcast_store::Store::new(self.0.join("podcasts")),
            article_store::Store::new(self.0.join("articles")),
        )
    }
}
impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn article(id: u64, text: &str) -> Value {
    json!({"language":"fr","pageId":id,"revision":2,"retrievedAt":3,"title":"Fictional music","text":text})
}
fn feed(url: &str) -> Value {
    json!({"url":url,"title":"Fictional podcast","author":"","episodes":[]})
}
fn seed() -> Value {
    json!({"origin":{"source":"server","authority":"https://previous.example","accountId":"previous","name":"Previous"},"podcasts":{"feeds":[feed("https://feeds.example.test/music.xml")],"episodes":[{"feed":"https://feeds.example.test/music.xml","id":"first"}]},"articles":[article(1,"First edition")]})
}
#[test]
fn restoration_explicitly_merges_into_actual_native_owner_and_preserves_existing_identities() {
    let clients = support::clients(&[("alice", "user"), ("bob", "user")]);
    let root = Sandbox::new();
    let (podcasts, articles) = root.stores();
    restore(&podcasts, &articles, Source::Server, &clients[0], &seed()).unwrap();
    let mut another = seed();
    another["articles"] = json!([article(1, "Old backup"), article(2, "New identity")]);
    restore(&podcasts, &articles, Source::Server, &clients[0], &another).unwrap();
    let exported = read(&podcasts, &articles, Source::Server, &clients[0]).unwrap();
    assert_eq!(exported["origin"]["accountId"], "alice");
    assert_eq!(
        exported["articles"],
        json!([article(1, "First edition"), article(2, "New identity")])
    );
    assert_eq!(exported["podcasts"]["feeds"].as_array().unwrap().len(), 1);
    assert_eq!(
        exported["podcasts"]["episodes"].as_array().unwrap().len(),
        1
    );
    assert_eq!(
        read(&podcasts, &articles, Source::Server, &clients[1]).unwrap()["articles"],
        json!([])
    );
    assert_eq!(
        read(&podcasts, &articles, Source::Local, &clients[0]).unwrap()["articles"],
        json!([])
    );
}
#[test]
fn corrupted_or_full_second_store_prevents_first_store_mutation_and_preserves_bytes() {
    let (client, _) = support::sessions();
    let root = Sandbox::new();
    let (podcasts, articles) = root.stores();
    restore(&podcasts, &articles, Source::Server, &client, &seed()).unwrap();
    let path = fs::read_dir(root.0.join("articles"))
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path();
    let original = fs::read(&path).unwrap();
    fs::write(&path, b"unreadable").unwrap();
    let before = podcasts.read(Source::Server, &client).unwrap();
    let mut another = seed();
    another["podcasts"]["feeds"] = json!([feed("https://feeds.example.test/second.xml")]);
    assert!(restore(&podcasts, &articles, Source::Server, &client, &another).is_err());
    assert_eq!(podcasts.read(Source::Server, &client).unwrap(), before);
    assert_eq!(fs::read(&path).unwrap(), b"unreadable");
    fs::write(&path, original).unwrap();
    for id in 2..=40 {
        articles
            .update(Source::Server, &client, "save", &article(id, "Retained"))
            .unwrap();
    }
    let before = fs::read(&path).unwrap();
    another["articles"] = json!([article(41, "Beyond capacity")]);
    assert!(restore(&podcasts, &articles, Source::Server, &client, &another).is_err());
    assert_eq!(fs::read(&path).unwrap(), before);
    assert_eq!(
        podcasts.read(Source::Server, &client).unwrap()["feeds"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}
#[test]
fn export_refuses_unreadable_private_state_and_restore_refuses_auditors_or_invalid_input() {
    let clients = support::clients(&[("alice", "user"), ("auditor", "auditor")]);
    let root = Sandbox::new();
    let (podcasts, articles) = root.stores();
    assert!(restore(&podcasts, &articles, Source::Server, &clients[1], &seed()).is_err());
    for payload in [
        json!({"origin":seed()["origin"],"podcasts":seed()["podcasts"],"articles":[article(1,"x".repeat(512*1024+1).as_str())]}),
        json!({"origin":seed()["origin"],"podcasts":seed()["podcasts"],"articles":[],"token":"forbidden"}),
    ] {
        assert!(restore(&podcasts, &articles, Source::Server, &clients[0], &payload).is_err());
    }
    assert!(!root.0.exists());
    restore(&podcasts, &articles, Source::Server, &clients[0], &seed()).unwrap();
    let path = fs::read_dir(root.0.join("podcasts"))
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path();
    fs::write(&path, b"unreadable").unwrap();
    assert!(read(&podcasts, &articles, Source::Server, &clients[0]).is_err());
    assert_eq!(fs::read(&path).unwrap(), b"unreadable");
}
#[test]
fn merge_preserves_unknown_retained_document_fields() {
    let (client, _) = support::sessions();
    let root = Sandbox::new();
    let (podcasts, articles) = root.stores();
    restore(&podcasts, &articles, Source::Server, &client, &seed()).unwrap();
    for kind in ["podcasts", "articles"] {
        let path = fs::read_dir(root.0.join(kind))
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        let mut value: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        value["future-field"] = json!({"retain":true});
        fs::write(&path, value.to_string()).unwrap();
    }
    let mut another = seed();
    another["articles"] = json!([article(2, "Second edition")]);
    another["podcasts"]["feeds"] = json!([feed("https://feeds.example.test/second.xml")]);
    restore(&podcasts, &articles, Source::Server, &client, &another).unwrap();
    for kind in ["podcasts", "articles"] {
        let path = fs::read_dir(root.0.join(kind))
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        let value: Value = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
        assert_eq!(value["future-field"], json!({"retain":true}));
    }
}

#[test]
fn retained_wrapper_extensions_are_preflighted_before_either_file_changes() {
    let (client, _) = support::sessions();
    let root = Sandbox::new();
    let (podcasts, articles) = root.stores();
    restore(&podcasts, &articles, Source::Server, &client, &seed()).unwrap();
    let path = fs::read_dir(root.0.join("articles"))
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path();
    let mut value: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    value["future-field"] = "x".repeat(3 * 1024 * 1024).into();
    fs::write(&path, value.to_string()).unwrap();
    let before = fs::read(&path).unwrap();
    assert!(articles.read(Source::Server, &client).is_ok());
    let mut imported = seed();
    imported["articles"] = json!([article(2, &"x".repeat(5000))]);
    imported["podcasts"]["feeds"] = json!([feed("https://feeds.example.test/second.xml")]);
    assert!(restore(&podcasts, &articles, Source::Server, &client, &imported).is_err());
    assert_eq!(fs::read(&path).unwrap(), before);
    assert_eq!(
        podcasts.read(Source::Server, &client).unwrap()["feeds"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}
