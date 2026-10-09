use super::*;
struct Sandbox(PathBuf);
impl Sandbox {
    fn new(name: &str) -> Self {
        let path =
            std::env::temp_dir().join(format!("phemios-local-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}
impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
#[test]
fn public_settings_never_return_secrets_and_corrupt_config_is_retained() {
    let data = Sandbox::new("secrets");
    let mut engine = Engine::new(data.0.clone(), PathBuf::from("missing-engine"));
    engine
        .keys("private-key", "another-key", false, false)
        .unwrap();
    let public = engine.status().unwrap().to_string();
    assert!(!public.contains("private-key"));
    assert!(!public.contains("another-key"));
    assert_eq!(engine.status().unwrap()["keys"]["fanart"], true);
    fs::write(engine.file(), b"broken").unwrap();
    assert!(engine.status().is_err());
    assert!(engine.keys("replacement", "", false, false).is_err());
    assert_eq!(fs::read(engine.file()).unwrap(), b"broken");
}
#[test]
fn unavailable_registered_folder_is_preserved_by_scan_request() {
    let data = Sandbox::new("roots");
    let engine = Engine::new(data.0.join("app"), PathBuf::from("missing-engine"));
    let path = data.0.join("offline");
    engine.add_roots(std::slice::from_ref(&path)).unwrap();
    let request = engine.scan_request(false, 2).unwrap();
    assert_eq!(request["folders"], request["unavailable_folders"]);
    fs::create_dir(&path).unwrap();
    assert_eq!(
        engine.scan_request(false, 2).unwrap()["unavailable_folders"],
        json!([])
    );
    assert!(engine.add_roots(&[PathBuf::from("relative")]).is_err());
}
#[test]
fn api_keys_preserve_empty_inputs_and_support_explicit_removal() {
    let data = Sandbox::new("keys");
    let mut engine = Engine::new(data.0.clone(), PathBuf::from("missing-engine"));
    engine.keys("first", "second", false, false).unwrap();
    engine.keys("", "", true, false).unwrap();
    let result = engine.status().unwrap();
    assert_eq!(result["keys"]["fanart"], false);
    assert_eq!(result["keys"]["acoustid"], true);
}

#[test]
fn unscanned_root_can_be_removed_without_starting_engine_or_touching_music() {
    let data = Sandbox::new("remove-new");
    let mut engine = Engine::new(data.0.join("app"), PathBuf::from("missing-engine"));
    let music = data.0.join("music");
    fs::create_dir(&music).unwrap();
    fs::write(music.join("original.flac"), b"untouched").unwrap();
    engine.add_roots(std::slice::from_ref(&music)).unwrap();
    engine
        .root_action(music.to_str().unwrap(), "remove")
        .unwrap();
    assert_eq!(engine.status().unwrap()["roots"], json!([]));
    assert_eq!(fs::read(music.join("original.flac")).unwrap(), b"untouched");
}
