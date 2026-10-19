use super::*;
#[test]
fn selected_regular_documents_are_read_without_writing_or_following_audio_paths() {
    let root = std::env::temp_dir().join(format!(
        "phemios-analysis-import-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir(&root).unwrap();
    let path = root.join("report.json");
    let document =
        r#"{"file_name":"track.flac","path":"/never/opened/track.flac","format":"FLAC"}"#;
    std::fs::write(&path, document).unwrap();
    assert_eq!(read_document(&path).unwrap(), document);
    assert_eq!(std::fs::read_to_string(&path).unwrap(), document);
    assert!(read_document(&root).is_err());
    std::fs::write(&path, [0xff, 0xfe]).unwrap();
    assert!(read_document(&path).is_err());
    let file = std::fs::File::create(&path).unwrap();
    file.set_len(LIMIT + 1).unwrap();
    drop(file);
    assert!(read_document(&path).is_err());
    #[cfg(unix)]
    {
        let link = root.join("linked.json");
        std::os::unix::fs::symlink(&path, &link).unwrap();
        assert!(read_document(&link).is_err());
        std::fs::remove_file(link).unwrap();
    }
    std::fs::remove_dir_all(root).unwrap();
}
