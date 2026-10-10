use super::*;
#[test]
fn exporting_a_theme_replaces_complete_json_and_refuses_invalid_replacements() {
    let folder = std::env::temp_dir().join(format!(
        "phemios-theme-test-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir(&folder).unwrap();
    let path = folder.join("theme.json");
    std::fs::write(&path, "old complete document").unwrap();
    write_document(&path, r#"{"format":"phemios-theme","version":1}"#).unwrap();
    let retained = std::fs::read(&path).unwrap();
    assert!(serde_json::from_slice::<serde_json::Value>(&retained).is_ok());
    assert!(write_document(&path, "malformed json").is_err());
    assert!(write_document(&path, &format!("\"{}\"", "x".repeat(4096))).is_err());
    assert_eq!(std::fs::read(&path).unwrap(), retained);
    assert_eq!(std::fs::read_dir(&folder).unwrap().count(), 1);
    std::fs::remove_dir_all(folder).unwrap();
}
