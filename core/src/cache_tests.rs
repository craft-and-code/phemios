use super::*;
use serde_json::json;
fn fixture() -> Cache {
    static NEXT: AtomicU64 = AtomicU64::new(1);
    Cache::new(std::env::temp_dir().join(format!(
        "phemios-cache-test-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    )))
}
#[test]
fn snapshots_round_trip_without_credentials_and_corruption_is_preserved() {
    let cache = fixture();
    assert!(cache.load().unwrap().is_none());
    let snapshot = cache
        .save(
            json!({"artists":[],"albums":[],"server":"http://localhost:1","accountId":"fictional"}),
        )
        .unwrap();
    assert_eq!(cache.load().unwrap(), Some(snapshot));
    fs::write(cache.root.join("catalog.json"), b"corrupt").unwrap();
    assert!(cache.load().is_err());
    assert_eq!(
        fs::read(cache.root.join("catalog.json")).unwrap(),
        b"corrupt"
    );
    fs::remove_dir_all(cache.root).unwrap();
}
#[test]
fn image_cache_is_shared_by_accounts_but_partitioned_by_authority_catalog_and_kind() {
    let cache = fixture();
    let snapshot = cache
        .save(
            json!({"artists":[],"albums":[],"server":"http://localhost:1","accountId":"fictional"}),
        )
        .unwrap();
    cache
        .save_image(&snapshot, "release:one", "cover", b"picture")
        .unwrap();
    assert_eq!(
        cache.image(&snapshot, "release:one", "cover").unwrap(),
        Some(b"picture".to_vec())
    );
    let mut other = snapshot.clone();
    other["accountId"] = json!("other");
    assert_eq!(
        cache.image(&other, "release:one", "cover").unwrap(),
        Some(b"picture".to_vec())
    );
    other["server"] = json!("https://different.invalid");
    assert!(
        cache
            .image(&other, "release:one", "cover")
            .unwrap()
            .is_none()
    );
    other = snapshot.clone();
    other["scannedAt"] = json!("next");
    assert!(
        cache
            .image(&other, "release:one", "cover")
            .unwrap()
            .is_none()
    );
    assert!(
        cache
            .image(&snapshot, "release:one", "banner")
            .unwrap()
            .is_none()
    );
    fs::remove_dir_all(cache.root).unwrap();
}
#[test]
fn unchanged_catalog_reuses_art_after_another_sync() {
    let cache = fixture();
    let snapshot = json!({"artists":[],"albums":[],"server":"http://localhost:1","accountId":"fictional","scannedAt":7,"cachedAt":"first"});
    cache
        .save_image(&snapshot, "release:one", "cover", b"picture")
        .unwrap();
    let mut refreshed = snapshot.clone();
    refreshed["cachedAt"] = json!("second");
    assert_eq!(
        cache.image(&refreshed, "release:one", "cover").unwrap(),
        Some(b"picture".to_vec())
    );
    fs::remove_dir_all(cache.root).unwrap();
}

#[test]
fn optional_public_track_and_label_arrays_refuse_corruption_without_replacing_cache() {
    let cache = fixture();
    let base =
        json!({"artists":[],"albums":[],"server":"http://localhost:1","accountId":"fictional"});
    let saved = cache.save(base.clone()).unwrap();
    for key in ["tracks", "labels"] {
        for invalid in [Value::Null, json!({})] {
            let mut next = base.clone();
            next[key] = invalid;
            assert!(cache.save(next).is_err());
            assert_eq!(cache.load().unwrap(), Some(saved.clone()));
        }
    }
    fs::remove_dir_all(cache.root).unwrap();
}

#[test]
fn a_supervised_projection_cannot_replace_the_shared_public_cache() {
    let cache = fixture();
    let public = cache
        .save(
            json!({"artists":[],"albums":[],"server":"https://music.example","accountId":"adult"}),
        )
        .unwrap();
    let mut restricted = public.clone();
    restricted["accountId"] = json!("child");
    restricted["parentalEnabled"] = json!(true);
    assert!(cache.save(restricted).is_err());
    assert_eq!(cache.load().unwrap(), Some(public));
    fs::remove_dir_all(cache.root).unwrap();
}

#[test]
fn public_publication_strips_disabled_parental_rules_from_bytes_and_returned_values() {
    let cache = fixture();
    let snapshot = cache.save(json!({"artists":[],"albums":[],"server":"https://music.example","accountId":"adult","parentalEnabled":false,"parentalRevision":4,"parentalPolicy":{"enabled":false,"blocked_artists":["artist:private-hidden"],"blocked_podcasts":["https://private.example/rss"]}})).unwrap();
    assert!(snapshot.get("parentalPolicy").is_none());
    assert_eq!(cache.load().unwrap(), Some(snapshot));
    let bytes = fs::read_to_string(cache.root.join("catalog.json")).unwrap();
    assert!(!bytes.contains("private-hidden"));
    assert!(!bytes.contains("private.example"));
    assert!(!bytes.contains("parentalPolicy"));
    assert!(!bytes.contains("parentalEnabled"));
    assert!(!bytes.contains("parentalRevision"));
    fs::remove_dir_all(cache.root).unwrap();
}

#[test]
fn old_supervised_disk_projections_are_refused_without_rewriting_the_cache() {
    let cache = fixture();
    fs::create_dir_all(&cache.root).unwrap();
    let bytes = json!({"artists":[],"albums":[],"server":"https://music.example","accountId":"child","parentalEnabled":true,"parentalPolicy":{"enabled":true}}).to_string();
    fs::write(cache.root.join("catalog.json"), &bytes).unwrap();
    assert!(cache.load().is_err());
    assert_eq!(
        fs::read_to_string(cache.root.join("catalog.json")).unwrap(),
        bytes
    );
    fs::remove_dir_all(cache.root).unwrap();
}

#[test]
fn old_public_cache_loses_parental_rules_in_memory_and_on_disk_without_changing_its_stamp() {
    let cache = fixture();
    fs::create_dir_all(&cache.root).unwrap();
    fs::write(cache.root.join("catalog.json"), json!({"artists":[],"albums":[],"server":"https://music.example","accountId":"adult","cachedAt":"original-stamp","parentalEnabled":false,"parentalRevision":4,"parentalPolicy":{"enabled":false,"blocked_artists":["artist:private-hidden"],"blocked_podcasts":["https://private.example/rss"]}}).to_string()).unwrap();
    let snapshot = cache.load().unwrap().unwrap();
    assert_eq!(snapshot["cachedAt"], "original-stamp");
    assert!(snapshot.get("parentalRevision").is_none());
    assert!(snapshot.get("parentalEnabled").is_none());
    assert!(snapshot.get("parentalPolicy").is_none());
    let bytes = fs::read_to_string(cache.root.join("catalog.json")).unwrap();
    assert!(!bytes.contains("parentalPolicy"));
    assert!(!bytes.contains("private-hidden"));
    assert!(!bytes.contains("private.example"));
    assert!(bytes.contains("original-stamp"));
    assert_eq!(cache.load().unwrap(), Some(snapshot));
    fs::remove_dir_all(cache.root).unwrap();
}

#[test]
fn catalog_migration_and_new_publication_share_one_clone_transaction() {
    use std::sync::mpsc;
    use std::time::Duration;
    let cache = fixture();
    fs::create_dir_all(&cache.root).unwrap();
    fs::write(cache.root.join("catalog.json"), json!({"artists":[],"albums":[],"server":"https://music.example","accountId":"adult","cachedAt":"old","parentalEnabled":false,"parentalPolicy":{"blocked_artists":["artist:private-hidden"]}}).to_string()).unwrap();
    let transaction = cache.catalog_io.lock().unwrap();
    let reader = cache.clone();
    let (reading, reading_started) = mpsc::channel();
    let (read_done, loaded) = mpsc::channel();
    let reader_thread = std::thread::spawn(move || {
        reading.send(()).unwrap();
        read_done.send(reader.load()).unwrap();
    });
    reading_started
        .recv_timeout(Duration::from_secs(3))
        .unwrap();
    assert!(matches!(
        loaded.recv_timeout(Duration::from_millis(40)),
        Err(mpsc::RecvTimeoutError::Timeout)
    ));
    let writer = cache.clone();
    let (writing, writing_started) = mpsc::channel();
    let (write_done, saved) = mpsc::channel();
    let writer_thread = std::thread::spawn(move || {
        writing.send(()).unwrap();
        write_done.send(writer.save(json!({"artists":[],"albums":[{"reference":"release:new"}],"server":"https://music.example","accountId":"adult"}))).unwrap();
    });
    writing_started
        .recv_timeout(Duration::from_secs(3))
        .unwrap();
    assert!(matches!(
        saved.recv_timeout(Duration::from_millis(40)),
        Err(mpsc::RecvTimeoutError::Timeout)
    ));
    // Neither the old read/migration nor the newer publication may cross another catalog transaction.
    drop(transaction);
    let migrated = loaded
        .recv_timeout(Duration::from_secs(3))
        .unwrap()
        .unwrap()
        .unwrap();
    let newest = saved.recv_timeout(Duration::from_secs(3)).unwrap().unwrap();
    reader_thread.join().unwrap();
    writer_thread.join().unwrap();
    assert!(migrated.get("parentalPolicy").is_none());
    assert_eq!(cache.load().unwrap(), Some(newest));
    assert!(
        fs::read_to_string(cache.root.join("catalog.json"))
            .unwrap()
            .contains("release:new")
    );
    fs::remove_dir_all(cache.root).unwrap();
}

#[test]
fn legacy_artwork_is_promoted_to_the_shared_cache_without_another_account_read() {
    let cache = fixture();
    let snapshot = json!({"artists":[],"albums":[],"server":"https://example.invalid","accountId":"first","scannedAt":7});
    let old = cache.image_path(&snapshot, "release:one", "cover", true);
    write_atomic(&old, b"retained-picture").unwrap();
    assert_eq!(
        cache.image(&snapshot, "release:one", "cover").unwrap(),
        Some(b"retained-picture".to_vec())
    );
    fs::remove_file(old).unwrap();
    let mut next = snapshot.clone();
    next["accountId"] = json!("second");
    assert_eq!(
        cache.image(&next, "release:one", "cover").unwrap(),
        Some(b"retained-picture".to_vec())
    );
    next["server"] = json!("https://different.invalid");
    assert!(
        cache
            .image(&next, "release:one", "cover")
            .unwrap()
            .is_none()
    );
    fs::remove_dir_all(cache.root).unwrap();
}
