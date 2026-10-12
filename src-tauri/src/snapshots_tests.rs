use super::*;
use serde_json::json;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

struct Sandbox(PathBuf);
impl Sandbox {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(1);
        let root = std::env::temp_dir().join(format!(
            "phemios-snapshots-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir(&root).unwrap();
        Self(root)
    }
}
impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

use crate::account_test_support::sessions;

fn catalog(client: &Client, scanned_at: u64) -> Value {
    json!({
        "artists": [], "albums": [], "scannedAt": scanned_at,
        "accountId": "fixture", "server": client.account()["server"]
    })
}

#[test]
fn logout_during_sync_preserves_disk_and_retained_snapshot() {
    let (original, _) = sessions();
    let sandbox = Sandbox::new();
    let cache = Cache::new(sandbox.0.clone());
    let before = Arc::new(cache.save(catalog(&original, 1)).unwrap());
    let disk = std::fs::read(sandbox.0.join("catalog.json")).unwrap();
    let retained = Mutex::new(Some(before.clone()));
    let logged_out = Mutex::new(None);

    assert!(
        publish(
            &logged_out,
            &retained,
            &cache,
            &original,
            catalog(&original, 2)
        )
        .is_err()
    );
    assert_eq!(std::fs::read(sandbox.0.join("catalog.json")).unwrap(), disk);
    assert!(Arc::ptr_eq(
        retained.lock().unwrap().as_ref().unwrap(),
        &before
    ));
}

#[test]
fn replacement_session_of_same_account_refuses_stale_sync_but_accepts_its_own() {
    let (original, replacement) = sessions();
    let sandbox = Sandbox::new();
    let cache = Cache::new(sandbox.0.clone());
    let before = Arc::new(cache.save(catalog(&replacement, 5)).unwrap());
    let disk = std::fs::read(sandbox.0.join("catalog.json")).unwrap();
    let retained = Mutex::new(Some(before.clone()));
    let current = Mutex::new(Some(replacement.clone()));

    assert!(
        publish(
            &current,
            &retained,
            &cache,
            &original,
            catalog(&original, 2)
        )
        .is_err()
    );
    assert_eq!(std::fs::read(sandbox.0.join("catalog.json")).unwrap(), disk);
    assert!(Arc::ptr_eq(
        retained.lock().unwrap().as_ref().unwrap(),
        &before
    ));

    let admitted = publish(
        &current,
        &retained,
        &cache,
        &replacement,
        catalog(&replacement, 6),
    )
    .unwrap();
    assert_eq!(admitted["scannedAt"], 6);
    assert_eq!(cache.load().unwrap().unwrap(), admitted);
    let held = retained.lock().unwrap();
    assert_eq!(held.as_ref().unwrap().as_ref(), &admitted);
    assert!(!Arc::ptr_eq(held.as_ref().unwrap(), &before));
}

#[test]
fn failed_cache_publication_preserves_disk_and_retained_snapshot() {
    let (client, _) = sessions();
    let sandbox = Sandbox::new();
    let cache = Cache::new(sandbox.0.clone());
    let before = Arc::new(cache.save(catalog(&client, 1)).unwrap());
    let disk = std::fs::read(sandbox.0.join("catalog.json")).unwrap();
    let retained = Mutex::new(Some(before.clone()));
    let current = Mutex::new(Some(client.clone()));
    let invalid =
        json!({"artists": null, "albums": [], "server": "fixture", "accountId": "fixture"});

    assert!(publish(&current, &retained, &cache, &client, invalid).is_err());
    assert_eq!(std::fs::read(sandbox.0.join("catalog.json")).unwrap(), disk);
    assert!(Arc::ptr_eq(
        retained.lock().unwrap().as_ref().unwrap(),
        &before
    ));
}

#[test]
fn disk_read_captured_before_sync_cannot_replace_its_newer_publication() {
    let (client, _) = sessions();
    let sandbox = Sandbox::new();
    let cache = Cache::new(sandbox.0.clone());
    let before = Arc::new(cache.save(catalog(&client, 1)).unwrap());
    let retained = Arc::new(Mutex::new(Some(before)));
    let captured = retained.lock().unwrap().clone();
    let old_disk_read = cache.load().unwrap();
    let session = Mutex::new(Some(client.clone()));

    // Deterministically place the real Sync disk/Arc commit between disk read and read admission.
    let synced = publish(&session, &retained, &cache, &client, catalog(&client, 2)).unwrap();
    let synced_arc = retained.lock().unwrap().clone().unwrap();
    let response = publish_cached(&retained, &captured, old_disk_read)
        .unwrap()
        .unwrap();
    assert_eq!(response, synced);
    assert_eq!(cache.load().unwrap().unwrap(), synced);
    assert!(Arc::ptr_eq(
        retained.lock().unwrap().as_ref().unwrap(),
        &synced_arc
    ));
}

#[test]
fn overlapping_reads_preserve_the_first_published_arc_even_for_identical_json() {
    let (client, _) = sessions();
    let sandbox = Sandbox::new();
    let cache = Cache::new(sandbox.0.clone());
    let before = Arc::new(cache.save(catalog(&client, 1)).unwrap());
    let retained = Arc::new(Mutex::new(Some(before.clone())));
    let captured = retained.lock().unwrap().clone();
    let old_disk_read = cache.load().unwrap();
    let current = load(cache.clone(), retained.clone()).unwrap().unwrap();
    let current_arc = retained.lock().unwrap().clone().unwrap();
    assert_eq!(before.as_ref(), current_arc.as_ref());
    assert!(!Arc::ptr_eq(&before, &current_arc));

    assert_eq!(
        publish_cached(&retained, &captured, old_disk_read)
            .unwrap()
            .unwrap(),
        current
    );
    assert!(Arc::ptr_eq(
        retained.lock().unwrap().as_ref().unwrap(),
        &current_arc
    ));
}

#[test]
fn uncontended_disk_read_can_install_the_retained_offline_snapshot() {
    let (client, _) = sessions();
    let sandbox = Sandbox::new();
    let cache = Cache::new(sandbox.0.clone());
    let saved = cache.save(catalog(&client, 1)).unwrap();
    let retained = Arc::new(Mutex::new(None));
    assert_eq!(load(cache, retained.clone()).unwrap(), Some(saved.clone()));
    assert_eq!(retained.lock().unwrap().as_ref().unwrap().as_ref(), &saved);
}
