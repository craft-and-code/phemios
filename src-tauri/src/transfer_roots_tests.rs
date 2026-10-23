use super::*;
use std::{
    fs,
    sync::atomic::{AtomicU64, Ordering},
};
struct Folder(PathBuf);
impl Folder {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let p = std::env::temp_dir().join(format!(
            "phemios-root-policy-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&p).unwrap();
        Self(p)
    }
    fn engine(&self) -> Arc<Mutex<Engine>> {
        Arc::new(Mutex::new(Engine::new(
            self.0.join("profile"),
            PathBuf::from("missing-engine"),
        )))
    }
}
impl Drop for Folder {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
#[test]
fn a_server_only_transfer_still_protects_configured_local_music_without_login() {
    let root = Folder::new();
    let dest = Folder::new();
    let engine = root.engine();
    let mount = Mounted::capture(dest.0.clone()).unwrap();
    let local = dest.0.join("offline-local-music");
    engine.lock().unwrap().add_roots(&[local]).unwrap();
    assert!(Protection::capture(&mount, engine, &[], &[]).is_err());
    assert!(fs::read_dir(&dest.0).unwrap().next().is_none());
}
#[test]
fn new_roots_or_unreadable_configuration_retire_the_old_preview() {
    let root = Folder::new();
    let dest = Folder::new();
    let engine = root.engine();
    let mount = Mounted::capture(dest.0.clone()).unwrap();
    let grant = Protection::capture(&mount, engine.clone(), &[], &[]).unwrap();
    engine
        .lock()
        .unwrap()
        .add_roots(&[root.0.join("music")])
        .unwrap();
    assert!(grant.confirm().is_err());
    let grant = Protection::capture(&mount, engine.clone(), &[], &[]).unwrap();
    fs::write(root.0.join("profile/desktop.json"), b"corrupt").unwrap();
    assert!(grant.confirm().is_err());
    assert_eq!(
        fs::read(root.0.join("profile/desktop.json")).unwrap(),
        b"corrupt"
    );
}
