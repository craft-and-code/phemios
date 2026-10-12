use super::*;
#[test]
fn csv_publication_preserves_existing_destination_on_failure_and_removes_temporary_files() {
    let folder = std::env::temp_dir().join(format!("phemios_csv_{}", std::process::id()));
    std::fs::create_dir_all(&folder).unwrap();
    let path = folder.join("report.csv");
    std::fs::write(&path, "original").unwrap();
    write_document(&path, "new Unicode é").unwrap();
    assert_eq!(std::fs::read_to_string(&path).unwrap(), "new Unicode é");
    let directory = folder.join("blocked.csv");
    std::fs::create_dir_all(&directory).unwrap();
    assert!(write_document(&directory, "refused").is_err());
    assert_eq!(std::fs::read_to_string(&path).unwrap(), "new Unicode é");
    assert!(std::fs::read_dir(&folder).unwrap().all(|entry| {
        !entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with(".phemios-csv-")
    }));
    std::fs::remove_dir_all(folder).unwrap();
}

#[test]
fn preference_documents_refuse_unknown_formats_credentials_and_oversized_content() {
    let values: serde_json::Map<String, serde_json::Value> = PREFERENCE_KEYS
        .iter()
        .map(|key| ((*key).to_owned(), serde_json::Value::Null))
        .collect();
    let valid =
        serde_json::json!({"format": "phemios-preferences", "version": 1, "values": values});
    assert!(validate_preferences(&valid.to_string()).is_ok());
    let mut changed = valid.clone();
    changed["values"]["api_key"] = serde_json::json!("not portable");
    assert!(validate_preferences(&changed.to_string()).is_err());
    changed = valid.clone();
    changed["version"] = serde_json::json!(2);
    assert!(validate_preferences(&changed.to_string()).is_err());
    assert!(validate_preferences(&" ".repeat(PREFERENCE_LIMIT + 1)).is_err());
    assert!(validate_preferences("not JSON").is_err());
}

#[test]
fn private_preference_backup_has_bounded_metadata_and_keeps_legacy_size_limit() {
    let values: serde_json::Map<String, serde_json::Value> = PREFERENCE_KEYS
        .iter()
        .map(|key| ((*key).to_owned(), serde_json::Value::Null))
        .collect();
    let personal = serde_json::json!({"origin":{"source":"local","authority":"phemios-managed-local","accountId":"alice","name":"Alice"},"podcasts":{"feeds":[],"episodes":[]},"articles":[{"language":"en","pageId":1,"revision":2,"retrievedAt":3,"title":"Fictional music","text":"x".repeat(150*1024)}]});
    let valid = serde_json::json!({"format":"phemios-preferences","version":2,"values":values,"personal":personal});
    assert!(validate_preferences(&valid.to_string()).unwrap());
    let mut invalid = valid.clone();
    invalid["personal"]["token"] = "not portable".into();
    assert!(validate_preferences(&invalid.to_string()).is_err());
    invalid = valid.clone();
    invalid["personal"]["articles"][0]["text"] = "x".repeat(512 * 1024 + 1).into();
    assert!(validate_preferences(&invalid.to_string()).is_err());
    let legacy =
        serde_json::json!({"format":"phemios-preferences","version":1,"values":valid["values"]});
    assert!(
        validate_preferences(&(legacy.to_string() + &" ".repeat(LEGACY_PREFERENCE_LIMIT))).is_err()
    );
    assert!(!validate_preferences(&legacy.to_string()).unwrap());
}
#[cfg(unix)]
#[test]
fn exported_private_document_has_owner_only_permissions() {
    use std::os::unix::fs::PermissionsExt;
    let folder =
        std::env::temp_dir().join(format!("phemios-private-export-{}", std::process::id()));
    std::fs::create_dir_all(&folder).unwrap();
    let path = folder.join("backup.json");
    write_document(&path, "{\"personal\":[]}").unwrap();
    assert_eq!(
        std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
        0o600
    );
    std::fs::remove_dir_all(folder).unwrap();
}

#[test]
fn private_backup_publication_refuses_replaced_generation_or_same_account_client() {
    use std::sync::{Mutex, atomic::AtomicU64};
    let (alice, relogged) = crate::account_test_support::sessions();
    let folder = std::env::temp_dir().join(format!(
        "phemios-private-export-ticket-{}",
        std::process::id()
    ));
    std::fs::create_dir_all(&folder).unwrap();
    let path = folder.join("backup.json");
    std::fs::write(&path, "existing").unwrap();
    for (client, epoch) in [(Some(alice.clone()), 1), (Some(relogged), 0), (None, 0)] {
        let held = Mutex::new(client);
        let generation = AtomicU64::new(epoch);
        assert!(
            write_private_preferences(
                &path,
                "private Alice backup",
                &held,
                &generation,
                "0",
                &alice
            )
            .is_err()
        );
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "existing");
    }
    let held = Mutex::new(Some(alice.clone()));
    let generation = AtomicU64::new(0);
    write_private_preferences(
        &path,
        "private Alice backup",
        &held,
        &generation,
        "0",
        &alice,
    )
    .unwrap();
    assert_eq!(
        std::fs::read_to_string(&path).unwrap(),
        "private Alice backup"
    );
    std::fs::remove_dir_all(folder).unwrap();
}
