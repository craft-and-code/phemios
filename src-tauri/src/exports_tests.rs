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
