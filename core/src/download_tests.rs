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

#[test]
fn folder_playlist_download_keeps_simple_bom_bytes_and_uses_only_opaque_names() {
    let root = std::env::temp_dir().join(format!("phemios-folder-playlist-{}", std::process::id()));
    let id = format!("m3u-file-{}", "c".repeat(64));
    let response = json!({"id":id,"filename":"../../unsafe.m3u8", "content":"\u{feff}one.flac\r\ntwo.mp3\r\n", "track_count":2});
    let first = publish_library_m3u(&root, &id, &response).unwrap();
    let second = publish_library_m3u(&root, &id, &response).unwrap();
    assert_eq!(first.file_name().unwrap(), format!("{id}.m3u8").as_str());
    assert_ne!(first, second);
    assert_eq!(
        fs::read(first).unwrap(),
        response["content"].as_str().unwrap().as_bytes()
    );
    assert!(
        publish_library_m3u(
            &root,
            &id,
            &json!({"id":"wrong", "filename":"one.m3u", "content":"one.flac", "track_count":1})
        )
        .is_err()
    );
    assert!(
        publish_library_m3u(
            &root,
            &id,
            &json!({"id":id, "filename":"one.m3u", "content":"one.flac\0", "track_count":1})
        )
        .is_err()
    );
    assert!(publish_library_m3u(&root, "../../escape", &response).is_err());
    assert!(
        publish_library_m3u(
            &root,
            &id,
            &json!({"id":id, "filename":"one.html", "content":"one.flac", "track_count":1})
        )
        .is_err()
    );
    assert!(
        publish_library_m3u(
            &root,
            &id,
            &json!({"id":id, "filename":"one.m3u", "content":"one.flac", "track_count":2})
        )
        .is_err()
    );
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn personal_note_exports_exact_markdown_and_never_overwrites() {
    let folder = std::env::temp_dir().join(format!("phemios-note-test-{}", std::process::id()));
    std::fs::create_dir_all(&folder).unwrap();
    let response = serde_json::json!({"reference":"release:fixture","annotation":{"reference":"release:fixture","note":"**Échos**\n- live\n"}});
    let first = super::publish_note(
        &folder,
        "release:fixture",
        &response,
        &serde_json::json!({"reference":"release:fixture", "title":"Échos"}),
    )
    .unwrap();
    let second = super::publish_note(
        &folder,
        "release:fixture",
        &response,
        &serde_json::json!({"reference":"release:fixture", "title":"Échos"}),
    )
    .unwrap();
    assert_ne!(first, second);
    assert_eq!(
        std::fs::read_to_string(&first).unwrap(),
        "**Échos**\n- live\n"
    );
    assert_eq!(first.extension().unwrap(), "md");
    assert_eq!(first.file_name().unwrap(), "Note-Échos.md");
    std::fs::remove_dir_all(folder).unwrap();
}
#[test]
fn personal_note_refuses_wrong_targets_empty_notes_and_unbounded_documents() {
    let folder = std::env::temp_dir().join(format!("phemios-note-refusal-{}", std::process::id()));
    let mut response = serde_json::json!({"reference":"release:fixture","annotation":{"reference":"release:fixture","note":"saved"}});
    assert!(
        super::publish_note(
            &folder,
            "release:other",
            &response,
            &serde_json::json!({"reference":"release:fixture", "title":"Échos"})
        )
        .is_err()
    );
    response["annotation"]["reference"] = serde_json::json!("release:other");
    assert!(
        super::publish_note(
            &folder,
            "release:fixture",
            &response,
            &serde_json::json!({"reference":"release:fixture", "title":"Échos"})
        )
        .is_err()
    );
    response["annotation"]["reference"] = serde_json::json!("release:fixture");
    for note in [
        " ".to_string(),
        "x".repeat(1024 * 1024 + 1),
        "bad\0note".into(),
    ] {
        response["annotation"]["note"] = serde_json::json!(note);
        assert!(
            super::publish_note(
                &folder,
                "release:fixture",
                &response,
                &serde_json::json!({"reference":"release:fixture", "title":"Échos"})
            )
            .is_err()
        );
    }
    assert!(!folder.exists());
}

#[test]
fn personal_note_title_is_catalogue_bound_and_cannot_escape_downloads() {
    let folder = std::env::temp_dir().join(format!("phemios-note-title-{}", std::process::id()));
    let response = serde_json::json!({"reference":"artist:fixture", "annotation":{"reference":"artist:fixture", "note":"saved"}});
    assert!(
        super::publish_note(
            &folder,
            "artist:fixture",
            &response,
            &serde_json::json!({"reference":"artist:other", "name":"Wrong owner target"})
        )
        .is_err()
    );
    let detail =
        serde_json::json!({"reference":"artist:fixture", "name":"../../Escaped\\Artist:*?"});
    let path = super::publish_note(&folder, "artist:fixture", &response, &detail).unwrap();
    assert_eq!(path.parent().unwrap(), folder);
    assert!(
        path.file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("Note-")
    );
    assert!(
        !path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .contains(['/', '\\', ':', '*', '?'])
    );
    let unicode = serde_json::json!({"reference":"artist:fixture", "name":"音楽".repeat(200)});
    let unicode_path = super::publish_note(&folder, "artist:fixture", &response, &unicode).unwrap();
    assert!(unicode_path.file_name().unwrap().len() <= 200);
    std::fs::remove_dir_all(folder).unwrap();
}
