use super::*;
#[test]
fn csv_publication_preserves_existing_destination_on_failure_and_removes_temporary_files() {
    let folder = std::env::temp_dir().join(format!("phemios_csv_{}", std::process::id()));
    std::fs::create_dir_all(&folder).unwrap();
    let path = folder.join("report.csv");
    std::fs::write(&path, "original").unwrap();
    write_csv(&path, "new Unicode é").unwrap();
    assert_eq!(std::fs::read_to_string(&path).unwrap(), "new Unicode é");
    let directory = folder.join("blocked.csv");
    std::fs::create_dir_all(&directory).unwrap();
    assert!(write_csv(&directory, "refused").is_err());
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
