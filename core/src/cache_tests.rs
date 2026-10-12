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
fn image_cache_is_partitioned_by_authority_account_and_catalog_version() {
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
