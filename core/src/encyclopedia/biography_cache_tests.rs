use super::*;
struct Fixture {
    root: PathBuf,
    store: Store,
}
impl Fixture {
    fn new() -> Self {
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
        let root = std::env::temp_dir().join(format!(
            "phemios-bio-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        Self {
            store: Store::new(root.clone()),
            root,
        }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}
fn response(revision: u64, text: bool) -> Value {
    let mut page = json!({"ns":0,"pageid":42,"title":"Example canon","lastrevid":revision});
    if text {
        page["extract"] = json!(format!("Fictional revision {revision}."));
    }
    json!({"query":{"pages":[page]}})
}
#[test]
fn reopening_and_restart_only_fetch_text_when_revision_or_identity_changed() {
    let fixture = Fixture::new();
    let mut calls = Vec::new();
    let first = fixture
        .store
        .refresh("fr", "Alias", |text| {
            calls.push(text);
            Ok(response(91, text))
        })
        .unwrap();
    assert_eq!(calls, [true]);
    let reopened = Store::new(fixture.root.clone());
    assert_eq!(reopened.get("fr", "Alias").unwrap(), Some(first.clone()));
    calls.clear();
    let unchanged = reopened
        .refresh("fr", "Alias", |text| {
            calls.push(text);
            Ok(response(91, text))
        })
        .unwrap();
    assert_eq!(calls, [false]);
    assert_eq!(unchanged, first); // Retrieval date and prose are retained too.
    calls.clear();
    let changed = reopened
        .refresh("fr", "Alias", |text| {
            calls.push(text);
            Ok(response(92, text))
        })
        .unwrap();
    assert_eq!(calls, [false, true]);
    assert_eq!(changed["revision"], 92);
    assert_eq!(reopened.get("fr", "Alias").unwrap(), Some(changed));
    calls.clear();
    let renamed = reopened
        .refresh("fr", "Alias", |text| {
            calls.push(text);
            let mut value = response(92, text);
            value["query"]["pages"][0]["pageid"] = json!(43);
            Ok(value)
        })
        .unwrap();
    assert_eq!(calls, [false, true]);
    assert_eq!(renamed["pageId"], 43);
}
#[test]
fn offline_or_malformed_refresh_preserves_the_readable_copy_without_overwriting_it() {
    let fixture = Fixture::new();
    let first = fixture
        .store
        .refresh("fr", "Example", |text| Ok(response(91, text)))
        .unwrap();
    for malformed in [
        None,
        Some(json!({"query":{"pages":[{"ns":0,"missing":true}]}})),
        Some(json!({"query":{"pages":[]}})),
        Some(
            json!({"query":{"pages":[{"ns":1,"pageid":42,"lastrevid":91,"title":"Example canon"}]}}),
        ),
    ] {
        assert!(
            fixture
                .store
                .refresh("fr", "Example", |_| malformed
                    .clone()
                    .ok_or("offline".into()))
                .is_err()
        );
        assert_eq!(
            fixture.store.get("fr", "Example").unwrap(),
            Some(first.clone())
        );
    }
    assert!(
        fixture
            .store
            .refresh("fr", "Example", |text| if text {
                Err("interrupted".into())
            } else {
                Ok(response(92, false))
            })
            .is_err()
    );
    assert_eq!(fixture.store.get("fr", "Example").unwrap(), Some(first));
}
#[test]
fn exact_edition_and_title_and_bounds_are_admitted_before_any_request() {
    let fixture = Fixture::new();
    assert!(!fixture.root.exists());
    assert_eq!(fixture.store.get("fr", "Example").unwrap(), None);
    fixture
        .store
        .refresh("fr", "Example", |text| Ok(response(91, text)))
        .unwrap();
    assert_eq!(fixture.store.get("en", "Example").unwrap(), None);
    assert_eq!(fixture.store.get("fr", "Other").unwrap(), None);
    for (lang, name) in [("de", "Example"), ("fr", "A|B"), ("fr", "A#B"), ("fr", "")] {
        assert!(
            fixture
                .store
                .refresh(lang, name, |_| panic!("must not dispatch"))
                .is_err()
        );
    }
}
#[test]
fn invalid_stores_are_bounded_and_never_implicitly_overwritten() {
    let fixture = Fixture::new();
    fixture
        .store
        .refresh("fr", "Example", |text| Ok(response(91, text)))
        .unwrap();
    let valid = std::fs::read(&fixture.store.path).unwrap();
    let mut data: Value = serde_json::from_slice(&valid).unwrap();
    data["rows"][0]["article"]["language"] = json!("en");
    let bad = serde_json::to_vec(&data).unwrap();
    std::fs::write(&fixture.store.path, &bad).unwrap();
    assert!(
        fixture
            .store
            .refresh("fr", "Example", |_| panic!("must not dispatch"))
            .is_err()
    );
    assert_eq!(std::fs::read(&fixture.store.path).unwrap(), bad);
    std::fs::File::create(&fixture.store.path)
        .unwrap()
        .set_len(LIMIT + 1)
        .unwrap();
    assert!(fixture.store.get("fr", "Example").is_err());
}
#[test]
fn entry_limit_evicts_only_the_oldest_disposable_public_copy() {
    let fixture = Fixture::new();
    for index in 0..=COUNT {
        fixture
            .store
            .refresh("fr", &format!("Example {index}"), |text| {
                Ok(response(91, text))
            })
            .unwrap();
    }
    assert_eq!(fixture.store.get("fr", "Example 0").unwrap(), None);
    assert!(fixture.store.get("fr", "Example 1").unwrap().is_some());
    assert_eq!(fixture.store.rows().unwrap().len(), COUNT);
}
#[cfg(unix)]
#[test]
fn refuses_a_cache_file_symlink() {
    let fixture = Fixture::new();
    std::fs::create_dir_all(&fixture.root).unwrap();
    let outside = fixture.root.join("other.json");
    std::fs::write(&outside, b"secret").unwrap();
    std::os::unix::fs::symlink(&outside, &fixture.store.path).unwrap();
    assert!(fixture.store.get("fr", "Example").is_err());
    assert_eq!(std::fs::read(&outside).unwrap(), b"secret");
}
