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
    assert_eq!(engine.fetch_keys().unwrap(), json!({"acoustid":"second"}));
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

#[test]
fn concert_key_is_protected_separate_from_engine_fetch_keys_and_survives_restart() {
    let data = Sandbox::new("concert-key");
    let engine = Engine::new(data.0.clone(), PathBuf::from("missing-engine"));
    assert!(engine.concert_key().unwrap().is_none());
    engine.set_concert_key("abcdefghijklmnop", false).unwrap();
    assert!(
        !engine
            .fetch_keys()
            .unwrap()
            .to_string()
            .contains("abcdefghijklmnop")
    );
    let mut restored = Engine::new(data.0.clone(), PathBuf::from("missing-engine"));
    assert_eq!(
        restored.concert_key().unwrap().as_deref(),
        Some("abcdefghijklmnop")
    );
    assert!(
        !restored
            .status()
            .unwrap()
            .to_string()
            .contains("abcdefghijklmnop")
    );
    restored.set_concert_key("", true).unwrap();
    assert!(engine.concert_key().unwrap().is_none());
    assert!(engine.set_concert_key("bad?key", false).is_err());
    fs::write(engine.file(), b"broken").unwrap();
    assert!(engine.set_concert_key("abcdefghijklmnop", false).is_err());
    assert!(engine.set_concert_key("", true).is_err());
    assert_eq!(fs::read(engine.file()).unwrap(), b"broken");
}

#[cfg(unix)]
#[test]
fn dangling_private_config_link_is_refused_and_retained_on_key_update() {
    use std::os::unix::fs::symlink;
    let data = Sandbox::new("dangling-config");
    let mut engine = Engine::new(data.0.clone(), PathBuf::from("missing-engine"));
    let missing = data.0.join("unavailable-private-config");
    symlink(&missing, engine.file()).unwrap();
    let status = engine.status();
    let write = engine.keys("replacement", "", false, false);
    assert!(
        status.is_err(),
        "An existing unreadable config must not become empty defaults"
    );
    assert!(
        write.is_err(),
        "A key update must preserve the unreadable config"
    );
    assert_eq!(fs::read_link(engine.file()).unwrap(), missing);
}

#[cfg(unix)]
#[test]
fn private_config_rejects_a_symlink_root_without_reading_or_writing_its_target() {
    use std::os::unix::fs::symlink;
    let data = Sandbox::new("symlink-root");
    let target = data.0.join("target");
    let mut original = Engine::new(target.clone(), PathBuf::from("missing-engine"));
    original
        .keys("fictional-retained-key", "", false, false)
        .unwrap();
    let before = fs::read(original.file()).unwrap();
    let linked = data.0.join("linked");
    symlink(&target, &linked).unwrap();
    let mut engine = Engine::new(linked.clone(), PathBuf::from("missing-engine"));
    assert!(engine.fetch_keys().is_err());
    assert!(
        engine
            .keys("fictional-replacement", "", false, false)
            .is_err()
    );
    assert_eq!(fs::read(original.file()).unwrap(), before);
    assert_eq!(fs::read_link(linked).unwrap(), target);
}

#[cfg(unix)]
#[test]
fn private_config_rejects_existing_group_or_world_writable_roots_and_preserves_them() {
    use std::os::unix::fs::PermissionsExt;
    let data = Sandbox::new("writable-root");
    for mode in [0o770, 0o707] {
        let root = data.0.join(format!("root-{mode:o}"));
        let mut engine = Engine::new(root.clone(), PathBuf::from("missing-engine"));
        engine
            .keys("fictional-retained-key", "", false, false)
            .unwrap();
        let before = fs::read(engine.file()).unwrap();
        fs::set_permissions(&root, fs::Permissions::from_mode(mode)).unwrap();
        assert!(engine.fetch_keys().is_err());
        assert!(
            engine
                .keys("fictional-replacement", "", false, false)
                .is_err()
        );
        assert_eq!(fs::read(engine.file()).unwrap(), before);
        assert_eq!(
            fs::metadata(&root).unwrap().permissions().mode() & 0o777,
            mode
        );
        assert!(!root.join("desktop.pending").exists());
        fs::remove_file(engine.file()).unwrap();
        assert!(
            engine
                .keys("fictional-replacement", "", false, false)
                .is_err()
        );
        assert!(!engine.file().exists());
    }
}

#[cfg(unix)]
#[test]
fn new_private_config_root_is_mode_700_without_changing_an_existing_safe_root() {
    use std::os::unix::fs::PermissionsExt;
    let data = Sandbox::new("private-root-mode");
    let root = data.0.join("new");
    let mut engine = Engine::new(root.clone(), PathBuf::from("missing-engine"));
    engine
        .keys("fictional-retained-key", "", false, false)
        .unwrap();
    assert_eq!(
        fs::metadata(&root).unwrap().permissions().mode() & 0o777,
        0o700
    );
    fs::set_permissions(&root, fs::Permissions::from_mode(0o750)).unwrap();
    engine
        .keys("fictional-replacement", "", false, false)
        .unwrap();
    assert_eq!(
        fs::metadata(&root).unwrap().permissions().mode() & 0o777,
        0o750
    );
}

#[test]
fn invalid_retained_concert_key_can_be_explicitly_removed_without_losing_other_config() {
    let data = Sandbox::new("remove-invalid-concert-key");
    let mut engine = Engine::new(data.0.clone(), PathBuf::from("missing-engine"));
    engine
        .keys("fictional-fanart-key", "", false, false)
        .unwrap();
    for invalid in [json!("invalid?fixture"), json!(42)] {
        let mut value = engine.config().unwrap();
        value["jambase"] = invalid;
        value["future-setting"] = json!({"retained":true});
        engine.save(&value).unwrap();
        assert!(engine.concert_key().is_err());
        engine.set_concert_key("", true).unwrap();
        assert!(engine.concert_key().unwrap().is_none());
        assert_eq!(
            engine.fetch_keys().unwrap(),
            json!({"fanart":"fictional-fanart-key"})
        );
        assert_eq!(
            engine.config().unwrap()["future-setting"],
            json!({"retained":true})
        );
    }
}

#[test]
fn selecting_new_concert_provider_removes_retired_key_without_touching_other_secrets() {
    let root = Sandbox::new("concert-provider-migration");
    let mut engine = Engine::new(root.0.clone(), PathBuf::from("missing-engine"));
    engine.keys("fictional-fanart", "", false, false).unwrap();
    let mut value = engine.config().unwrap();
    value["ticketmaster"] = json!("retired-secret");
    engine.save(&value).unwrap();
    assert!(engine.concert_key().unwrap().is_none());
    engine
        .set_concert_key("jbd_abcdefghijklmnop", false)
        .unwrap();
    assert!(engine.config().unwrap().get("ticketmaster").is_none());
    assert_eq!(engine.fetch_keys().unwrap()["fanart"], "fictional-fanart");
    assert!(!engine.status().unwrap().to_string().contains("jbd_"));
}

#[test]
fn a_busy_concert_budget_refuses_key_changes_before_persisting_them() {
    let root = Sandbox::new("concert-key-busy");
    let engine = Engine::new(root.0.clone(), PathBuf::from("missing-engine"));
    engine
        .set_concert_key("jbd_originalfixturekey", false)
        .unwrap();
    let active = engine.concert_budget().unwrap();
    assert!(
        engine
            .configure_concerts(Some("jbd_replacementfixturekey"), false)
            .is_err()
    );
    assert_eq!(
        engine.concert_key().unwrap().as_deref(),
        Some("jbd_originalfixturekey")
    );
    assert!(engine.configure_concerts(None, true).is_err());
    assert_eq!(
        engine.concert_key().unwrap().as_deref(),
        Some("jbd_originalfixturekey")
    );
    drop(active);
    engine
        .configure_concerts(Some("jbd_replacementfixturekey"), false)
        .unwrap();
    assert_eq!(
        engine.concert_key().unwrap().as_deref(),
        Some("jbd_replacementfixturekey")
    );
    engine.configure_concerts(None, true).unwrap();
    assert!(engine.concert_key().unwrap().is_none());
}

#[test]
fn concert_configuration_projection_never_exposes_the_key_or_resets_usage() {
    let root = Sandbox::new("concert-key-projection");
    let engine = Engine::new(root.0.clone(), PathBuf::from("missing-engine"));
    let secret = "jbd_fictionalconfigurationkey";
    let saved = engine.configure_concerts(Some(secret), false).unwrap();
    assert_eq!(saved["ready"], true);
    assert!(!saved.to_string().contains(secret));
    assert!(!engine.fetch_keys().unwrap().to_string().contains(secret));
    let restored = Engine::new(root.0.clone(), PathBuf::from("missing-engine"));
    assert_eq!(restored.configure_concerts(None, false).unwrap(), saved);
    let removed = restored.configure_concerts(None, true).unwrap();
    assert_eq!(removed["ready"], false);
    assert_eq!(removed["used"], saved["used"]);
    assert!(!removed.to_string().contains(secret));
}
