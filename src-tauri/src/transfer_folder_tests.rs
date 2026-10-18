use super::*;
use std::sync::atomic::AtomicU64;
struct Folder(PathBuf);
impl Folder {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let path = std::env::temp_dir().join(format!(
            "phemios-destination-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir(&path).unwrap();
        Self(path)
    }
}
impl Drop for Folder {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
#[test]
fn cancellation_is_a_noop_and_running_work_never_opens_a_destination_dialog() {
    let transfer = Transfers::default();
    assert!(pick(&transfer, || Ok(None)).unwrap().is_none());
    assert!(transfer.inventory.lock().unwrap().is_null());
    transfer.running.store(true, Ordering::Release);
    assert!(
        pick(&transfer, || panic!(
            "a running job must not open a chooser"
        ))
        .is_err()
    );
}
#[test]
fn folder_selection_is_read_only_deduplicated_and_replaces_only_the_previous_manual_folder() {
    let transfer = Transfers::default();
    let first = Folder::new();
    let second = Folder::new();
    let a = pick(&transfer, || Ok(Some(first.0.clone())))
        .unwrap()
        .unwrap();
    assert_eq!(a["kind"], "folder");
    assert_eq!(a["ejectable"], false);
    assert_eq!(std::fs::read_dir(&first.0).unwrap().count(), 0);
    let b = pick(&transfer, || Ok(Some(second.0.clone())))
        .unwrap()
        .unwrap();
    let c = pick(&transfer, || Ok(Some(second.0.clone())))
        .unwrap()
        .unwrap();
    let inventory = transfer.inventory.lock().unwrap();
    assert_eq!(inventory["volumes"].as_array().unwrap().len(), 1);
    assert_eq!(c["path"], b["path"]);
    let targets = transfer.targets.lock().unwrap();
    assert_eq!(targets.len(), 1);
    assert_eq!(targets[0].0, c["id"].as_str().unwrap());
    assert_eq!(std::fs::read_dir(&first.0).unwrap().count(), 0);
    assert_eq!(std::fs::read_dir(&second.0).unwrap().count(), 0);
}
#[test]
fn a_manual_destination_survives_discovery_but_a_replaced_folder_does_not() {
    let transfer = Transfers::default();
    let root = Folder::new();
    let path = root.0.join("output");
    std::fs::create_dir(&path).unwrap();
    pick(&transfer, || Ok(Some(path.clone()))).unwrap();
    let mut rows = Vec::new();
    let mut targets = Vec::new();
    retain(&transfer, &mut rows, &mut targets).unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(targets.len(), 1);
    retain(&transfer, &mut rows, &mut targets).unwrap();
    assert_eq!(rows.len(), 1);
    std::fs::rename(&path, root.0.join("old")).unwrap();
    std::fs::create_dir(&path).unwrap();
    rows.clear();
    targets.clear();
    retain(&transfer, &mut rows, &mut targets).unwrap();
    assert!(rows.is_empty());
    assert!(targets.is_empty());
    assert!(transfer.folder.lock().unwrap().is_none());
}
#[test]
fn selecting_an_already_discovered_volume_reuses_its_adapter_and_eject_capability() {
    let transfer = Transfers::default();
    let root = Folder::new();
    let mount = Mounted::capture(root.0.clone()).unwrap();
    let path = mount.path().to_string_lossy();
    *transfer.inventory.lock().unwrap() = json!({"volumes":[{"id":"mount:42","path":path,"adapter":"mounted","ejectable":true}],"warning":""});
    transfer
        .targets
        .lock()
        .unwrap()
        .push(("mount:42".into(), Target::Mounted(mount)));
    let row = pick(&transfer, || Ok(Some(root.0.clone())))
        .unwrap()
        .unwrap();
    assert_eq!(row["id"], "mount:42");
    assert_eq!(row["ejectable"], true);
    assert_eq!(transfer.targets.lock().unwrap().len(), 1);
}
