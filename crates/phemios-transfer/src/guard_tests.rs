use super::*;
use std::sync::atomic::{AtomicU64, Ordering};
struct Folder(PathBuf);
impl Folder {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let p = std::env::temp_dir().join(format!(
            "phemios-guard-{}-{}",
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
fn unavailable_local_overlap_is_refused_without_creating_the_root() {
    let root = Folder::new();
    let mount = Mounted::capture(root.0.clone()).unwrap();
    let missing = root.0.join("offline/album");
    assert!(DestinationGuard::capture(&mount, std::slice::from_ref(&missing), &[]).is_err());
    assert!(!missing.exists());
}
#[test]
fn unavailable_disjoint_local_root_is_retained_and_its_return_retires_the_grant() {
    let root = Folder::new();
    let dest = Folder::new();
    let missing = root.0.join("offline");
    let mount = Mounted::capture(dest.0.clone()).unwrap();
    let guard = DestinationGuard::capture(&mount, std::slice::from_ref(&missing), &[]).unwrap();
    guard.confirm().unwrap();
    fs::create_dir(&missing).unwrap();
    assert!(guard.confirm().is_err());
    assert!(fs::read_dir(&dest.0).unwrap().next().is_none());
}
#[test]
fn remote_paths_remain_hints_but_returning_overlap_is_not_permission_to_write() {
    let dest = Folder::new();
    let mount = Mounted::capture(dest.0.clone()).unwrap();
    let returning = dest.0.join("remote-root");
    let hints = vec![
        returning.to_str().unwrap().to_owned(),
        "Z:\\ForeignServer\\UnavailableMusic".into(),
    ];
    let guard = DestinationGuard::capture(&mount, &[], &hints).unwrap();
    guard.confirm().unwrap();
    fs::create_dir(&returning).unwrap();
    assert!(guard.confirm().is_err());
    assert!(mount.confirm().is_ok());
}
#[test]
fn local_directory_replacement_retires_an_old_grant_even_when_disjoint() {
    let source = Folder::new();
    let dest = Folder::new();
    let path = source.0.join("library");
    fs::create_dir(&path).unwrap();
    let mount = Mounted::capture(dest.0.clone()).unwrap();
    let guard = DestinationGuard::capture(&mount, std::slice::from_ref(&path), &[]).unwrap();
    fs::rename(&path, source.0.join("previous")).unwrap();
    fs::create_dir(&path).unwrap();
    assert!(guard.confirm().is_err());
}
#[cfg(unix)]
#[test]
fn missing_local_roots_under_symlinked_ancestors_cannot_alias_the_destination() {
    let source = Folder::new();
    let dest = Folder::new();
    let alias = source.0.join("alias");
    std::os::unix::fs::symlink(&dest.0, &alias).unwrap();
    let mount = Mounted::capture(dest.0.clone()).unwrap();
    assert!(DestinationGuard::capture(&mount, &[alias.join("missing")], &[]).is_err());
    let broken = source.0.join("broken");
    std::os::unix::fs::symlink(source.0.join("absent"), &broken).unwrap();
    assert!(DestinationGuard::capture(&mount, &[broken.join("music")], &[]).is_err());
}

#[cfg(unix)]
#[test]
fn a_local_alias_retargeted_into_the_destination_retires_the_preview() {
    let source = Folder::new();
    let dest = Folder::new();
    let real = source.0.join("library");
    fs::create_dir(&real).unwrap();
    let alias = source.0.join("alias");
    std::os::unix::fs::symlink(&real, &alias).unwrap();
    let mount = Mounted::capture(dest.0.clone()).unwrap();
    let guard = DestinationGuard::capture(&mount, std::slice::from_ref(&alias), &[]).unwrap();
    fs::remove_file(&alias).unwrap();
    std::os::unix::fs::symlink(&dest.0, &alias).unwrap();
    assert!(guard.confirm().is_err());
}
