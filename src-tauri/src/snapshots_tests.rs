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

#[test]
fn supervised_publication_is_process_only_and_does_not_replace_the_adult_disk_cache() {
    let (client, _) = sessions();
    let sandbox = Sandbox::new();
    let cache = Cache::new(sandbox.0.clone());
    let public = cache.save(catalog(&client, 1)).unwrap();
    let mut restricted = catalog(&client, 2);
    restricted["parentalEnabled"] = json!(true);
    restricted["parentalRevision"] = json!(1);
    let session = Mutex::new(Some(client.clone()));
    let retained = Mutex::new(None);
    publish(&session, &retained, &cache, &client, restricted.clone()).unwrap();
    assert_eq!(cache.load().unwrap(), Some(public));
    assert_eq!(retained.lock().unwrap().as_deref(), Some(&restricted));
    assert!(!projection_contains(&restricted, "artist:hidden"));
}

fn retired_sync(replacement: bool, pause_at: usize) {
    retired_sync_status(replacement, pause_at, 200);
}
fn retired_sync_status(replacement: bool, pause_at: usize, status: u16) {
    let fixture = super::test_support::catalog_server_status(pause_at, status);
    let sandbox = Sandbox::new();
    let cache = Cache::new(sandbox.0.clone());
    let before = Arc::new(cache.save(catalog(&fixture.client, 1)).unwrap());
    let disk = std::fs::read(sandbox.0.join("catalog.json")).unwrap();
    let retained = Arc::new(Mutex::new(Some(before.clone())));
    let session = Arc::new(Mutex::new(Some(fixture.client.clone())));
    let running_session = session.clone();
    let running_retained = retained.clone();
    let client = fixture.client.clone();
    let sync =
        std::thread::spawn(move || synchronize(running_session, running_retained, cache, client));
    fixture
        .pending
        .recv_timeout(std::time::Duration::from_secs(5))
        .unwrap();
    *session.lock().unwrap() = if replacement {
        Some(fixture.replacement.clone())
    } else {
        None
    };
    fixture.resume.send(()).unwrap();
    let answer = sync.join().unwrap();
    fixture.stop.send(()).unwrap();
    let paths = fixture.worker.join().unwrap();
    assert!(answer.is_err());
    assert_eq!(std::fs::read(sandbox.0.join("catalog.json")).unwrap(), disk);
    assert!(Arc::ptr_eq(
        retained.lock().unwrap().as_ref().unwrap(),
        &before
    ));
    assert_eq!(
        paths.len(),
        pause_at,
        "retired snapshot dispatched extra pages: {paths:?}"
    );
}
#[test]
fn retired_sync_stops_before_requesting_another_catalogue_page() {
    retired_sync(false, 1);
}
#[test]
fn retired_sync_stops_on_replacement_login() {
    retired_sync(true, 1);
}
#[test]
fn retired_sync_stops_between_label_details() {
    retired_sync(false, 6);
}

#[test]
fn current_sync_publishes_complete_paged_catalogue_and_label_details() {
    let fixture = super::test_support::catalog_server(1);
    let sandbox = Sandbox::new();
    let cache = Cache::new(sandbox.0.clone());
    let retained = Arc::new(Mutex::new(None));
    let session = Arc::new(Mutex::new(Some(fixture.client.clone())));
    fixture.resume.send(()).unwrap();
    let result = synchronize(session, retained.clone(), cache.clone(), fixture.client).unwrap();
    fixture.stop.send(()).unwrap();
    assert_eq!(fixture.worker.join().unwrap().len(), 8);
    assert_eq!(result["artists"].as_array().unwrap().len(), 201);
    assert_eq!(result["labels"].as_array().unwrap().len(), 2);
    assert_eq!(cache.load().unwrap().as_ref(), Some(&result));
    assert_eq!(retained.lock().unwrap().as_deref(), Some(&result));
}

#[test]
fn sync_retired_before_worker_execution_dispatches_no_catalogue_request() {
    let fixture = super::test_support::catalog_server(1);
    let sandbox = Sandbox::new();
    let answer = synchronize(
        Arc::new(Mutex::new(None)),
        Arc::new(Mutex::new(None)),
        Cache::new(sandbox.0.clone()),
        fixture.client,
    );
    fixture.stop.send(()).unwrap();
    assert!(answer.is_err());
    assert!(fixture.worker.join().unwrap().is_empty());
    assert!(!sandbox.0.join("catalog.json").exists());
}

#[test]
fn retired_sync_never_retries_busy_pages_after_logout_or_replacement() {
    for status in [409, 429, 503] {
        for replacement in [false, true] {
            retired_sync_status(replacement, 1, status);
        }
    }
}

#[test]
fn busy_private_write_authorization_never_retries_or_commits_after_logout() {
    let fixture = super::test_support::catalog_server_status(1, 503);
    let session = Arc::new(Mutex::new(Some(fixture.client.clone())));
    let generation = Arc::new(AtomicU64::new(1));
    let committed = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let running_session = session.clone();
    let running_generation = generation.clone();
    let running_commit = committed.clone();
    let client = fixture.client.clone();
    let write = std::thread::spawn(move || {
        crate::sessions::private_write(&running_session, &running_generation, "1", &client, || {
            running_commit.store(true, Ordering::SeqCst);
            Ok(())
        })
    });
    fixture
        .pending
        .recv_timeout(std::time::Duration::from_secs(5))
        .unwrap();
    *session.lock().unwrap() = None;
    generation.fetch_add(1, Ordering::SeqCst);
    fixture.resume.send(()).unwrap();
    assert!(write.join().unwrap().is_err());
    fixture.stop.send(()).unwrap();
    let paths = fixture.worker.join().unwrap();
    assert_eq!(paths, ["/api/auth/v1/session"]);
    assert!(!committed.load(Ordering::SeqCst));
}

#[test]
fn current_sync_retries_busy_response_and_publishes_the_complete_catalogue() {
    let fixture = super::test_support::catalog_server_status(1, 429);
    let sandbox = Sandbox::new();
    let cache = Cache::new(sandbox.0.clone());
    let retained = Arc::new(Mutex::new(None));
    let session = Arc::new(Mutex::new(Some(fixture.client.clone())));
    fixture.resume.send(()).unwrap();
    let result = synchronize(session, retained.clone(), cache.clone(), fixture.client).unwrap();
    fixture.stop.send(()).unwrap();
    let paths = fixture.worker.join().unwrap();
    assert_eq!(paths.len(), 9);
    assert_eq!(paths[0], paths[1]);
    assert_eq!(result["artists"].as_array().unwrap().len(), 201);
    assert_eq!(result["labels"].as_array().unwrap().len(), 2);
    assert_eq!(cache.load().unwrap().as_ref(), Some(&result));
    assert_eq!(retained.lock().unwrap().as_deref(), Some(&result));
}
