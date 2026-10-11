use super::*;
use serde_json::json;
#[test]
fn repeated_downloads_preserve_existing_bytes_and_exact_server_content() {
    let root = std::env::temp_dir().join(format!("phemios-download-{}", std::process::id()));
    let id = format!("playlist-{}", "a".repeat(64));
    let response =
        json!({"id":id,"content":"#EXTM3U\n/music/fictional.flac\n","filename":"../../untrusted"});
    let first = publish(&root, &id, &response).unwrap();
    fs::write(&first, b"user-edited").unwrap();
    let second = publish(&root, &id, &response).unwrap();
    assert_ne!(first, second);
    assert_eq!(fs::read(first).unwrap(), b"user-edited");
    assert_eq!(
        fs::read_to_string(second).unwrap(),
        response["content"].as_str().unwrap()
    );
    fs::remove_dir_all(root).unwrap();
}
#[test]
fn invalid_identity_or_content_never_creates_the_download_directory() {
    let root =
        std::env::temp_dir().join(format!("phemios-invalid-download-{}", std::process::id()));
    let id = format!("playlist-{}", "b".repeat(64));
    assert!(
        publish(
            &root,
            "../../source",
            &json!({"id":"../../source","content":"#EXTM3U"})
        )
        .is_err()
    );
    assert!(publish(&root, &id, &json!({"id":id,"content":"invalid"})).is_err());
    assert!(publish(&root, &id, &json!({"id":"other","content":"#EXTM3U"})).is_err());
    assert!(!root.exists());
}

#[test]
fn analysis_download_preserves_original_fields_and_never_replaces_a_previous_report() {
    let root =
        std::env::temp_dir().join(format!("phemios-analysis-download-{}", std::process::id()));
    let report = serde_json::json!({"format":"flaccompagnon-report","version":1,"report":{"root":"/music/album","files":[{"path":"/music/album/one.flac","unknown_future":42}],"has_flac":true}});
    let a = publish_analysis(&root, "track:one", &report).unwrap();
    let b = publish_analysis(&root, "track:one", &report).unwrap();
    assert_ne!(a, b);
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&std::fs::read(a).unwrap()).unwrap(),
        report
    );
    assert!(publish_analysis(&root, "../../escape", &report).is_err());
    assert!(
        publish_analysis(
            &root,
            "track:one",
            &serde_json::json!({"format":"flaccompagnon-report","report":{"files":[]}})
        )
        .is_err()
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn spectrum_download_preserves_image_bytes_and_uses_confined_unique_names() {
    let root =
        std::env::temp_dir().join(format!("phemios-spectrum-download-{}", std::process::id()));
    let png = b"\x89PNG\r\n\x1a\nretained-spectrum";
    let first = publish_spectrum(&root, "track:one", png).unwrap();
    let second = publish_spectrum(&root, "track:one", png).unwrap();
    assert_ne!(first, second);
    assert_eq!(fs::read(first).unwrap(), png);
    assert_eq!(second.extension().unwrap(), "png");
    assert!(publish_spectrum(&root, "../../escape", png).is_err());
    assert!(publish_spectrum(&root, "track:one", b"not an image").is_err());
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn wikipedia_text_exports_are_identity_scoped_and_repeated_downloads_preserve_previous_files() {
    let folder =
        std::env::temp_dir().join(format!("phemios_wikipedia_download_{}", std::process::id()));
    let document =
        "\u{feff}Wikipédia · FR · 42\nFictional article\nSource and licence\nTexte français.";
    let first = publish_wikipedia(&folder, "fr", 42, document).unwrap();
    let second = publish_wikipedia(&folder, "fr", 42, document).unwrap();
    assert_ne!(first, second);
    assert_eq!(first.extension().unwrap(), "txt");
    assert_eq!(std::fs::read_to_string(first).unwrap(), document);
    assert!(publish_wikipedia(&folder, "en", 42, document).is_err());
    assert!(publish_wikipedia(&folder, "fr", 43, document).is_err());
    assert!(publish_wikipedia(&folder, "../../path", 42, document).is_err());
    assert!(publish_wikipedia(&folder, "fr", 0, document).is_err());
    assert!(publish_wikipedia(&folder, "fr", 42, &format!("{document}\0")).is_err());
    assert!(
        publish_wikipedia(
            &folder,
            "fr",
            42,
            &format!("{document}{}", "x".repeat(1024 * 1024))
        )
        .is_err()
    );
    assert_eq!(std::fs::read_dir(&folder).unwrap().count(), 2);
    std::fs::remove_dir_all(folder).unwrap();
}
