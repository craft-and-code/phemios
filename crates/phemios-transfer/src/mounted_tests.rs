use super::*;
use std::sync::atomic::{AtomicU64, Ordering};
struct Folder(PathBuf);
impl Folder {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let p = std::env::temp_dir().join(format!(
            "phemios-mount-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&p).unwrap();
        Self(p)
    }
}
impl Drop for Folder {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
#[test]
fn a_replaced_mount_is_refused_and_rockbox_does_not_use_the_apple_database() {
    let folder = Folder::new();
    let path = folder.0.join("device");
    fs::create_dir(&path).unwrap();
    fs::create_dir(path.join("iPod_Control")).unwrap();
    let apple = Mounted::capture(path.clone()).unwrap();
    assert!(apple.apple_ipod());
    fs::create_dir(path.join(".rockbox")).unwrap();
    assert!(!Mounted::capture(path.clone()).unwrap().apple_ipod());
    apple.confirm().unwrap();
    fs::rename(&path, folder.0.join("removed")).unwrap();
    fs::create_dir(&path).unwrap();
    assert!(apple.confirm().is_err());
}
#[test]
fn watched_sources_are_refused_in_both_overlap_directions() {
    let folder = Folder::new();
    let music = folder.0.join("music");
    fs::create_dir(&music).unwrap();
    let mounted = Mounted::capture(folder.0.clone()).unwrap();
    assert!(mounted.outside(&[music.to_str().unwrap().into()]).is_err());
    let nested = Mounted::capture(music).unwrap();
    assert!(
        nested
            .outside(&[folder.0.to_str().unwrap().into()])
            .is_err()
    );
    let other = Folder::new();
    nested.outside(&[other.0.to_str().unwrap().into()]).unwrap();
}
#[cfg(unix)]
#[test]
fn a_symbolic_link_is_not_a_mount_identity() {
    let folder = Folder::new();
    let alias = folder.0.join("alias");
    std::os::unix::fs::symlink(&folder.0, &alias).unwrap();
    assert!(Mounted::capture(alias).is_err());
}
