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
