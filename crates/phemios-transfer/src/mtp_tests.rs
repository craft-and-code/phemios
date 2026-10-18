use super::*;
use mtp_rs::{
    VirtualDeviceConfig, VirtualStorageConfig, register_virtual_device, unregister_virtual_device,
};
struct Virtual {
    root: std::path::PathBuf,
    location: u64,
}
impl Drop for Virtual {
    fn drop(&mut self) {
        unregister_virtual_device(self.location);
        let _ = std::fs::remove_dir_all(&self.root);
    }
}
#[test]
fn virtual_mtp_uploads_and_verifies_without_overwriting_existing_music() {
    let root = std::env::temp_dir().join(format!("phemios-virtual-mtp-{}", std::process::id()));
    std::fs::create_dir(&root).unwrap();
    let storage_root = root.join("storage");
    std::fs::create_dir(&storage_root).unwrap();
    let config = VirtualDeviceConfig {
        serial: format!("transfer-test-{}", std::process::id()),
        watch_backing_dirs: false,
        event_poll_interval: Duration::ZERO,
        storages: vec![VirtualStorageConfig {
            description: "Test storage".into(),
            capacity: 1024 * 1024 * 16,
            backing_dir: storage_root.clone(),
            read_only: false,
        }],
        ..Default::default()
    };
    let info = register_virtual_device(&config);
    let _guard = Virtual {
        root: root.clone(),
        location: info.location_id,
    };
    let storage = block_on(async {
        let device = MtpDevice::open_by_location(info.location_id).await.unwrap();
        let id = device.storages().await.unwrap()[0].id();
        device.close().await.unwrap();
        id
    });
    let target = MtpTarget {
        id: "virtual".into(),
        name: "Test storage".into(),
        location: info.location_id,
        serial: info.serial_number,
        vendor: info.vendor_id,
        product: info.product_id,
        storage,
        free: 1024 * 1024 * 16,
    };
    let source = root.join("source.mp3");
    let bytes = vec![42u8; 150_000];
    std::fs::write(&source, &bytes).unwrap();
    let relative = Path::new("Artist").join("Album").join("01.mp3");
    target.upload(&relative, &source, true, &|| Ok(())).unwrap();
    assert_eq!(std::fs::read(storage_root.join(&relative)).unwrap(), bytes);
    // A repeat verifies and skips; a same-size different source is refused without deletion.
    target.upload(&relative, &source, true, &|| Ok(())).unwrap();
    std::fs::write(&source, vec![7u8; bytes.len()]).unwrap();
    assert!(target.upload(&relative, &source, true, &|| Ok(())).is_err());
    assert_eq!(std::fs::read(storage_root.join(&relative)).unwrap(), bytes);
    assert!(
        target
            .upload(
                &Path::new("Artist").join("canceled.mp3"),
                &source,
                true,
                &|| Err("canceled".into())
            )
            .is_err()
    );
    assert!(!storage_root.join("Artist").join("canceled.mp3").exists());
}
