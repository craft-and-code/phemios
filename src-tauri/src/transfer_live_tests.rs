use super::*;
#[test]
fn embedded_https_export_runs_through_the_real_copy_pipeline() {
    live_export("original");
}
#[test]
fn embedded_https_flac_preview_matches_the_actual_mp3_output() {
    if ["ffmpeg", "ffprobe"].iter().any(|tool| {
        std::process::Command::new(tool)
            .arg("-version")
            .output()
            .is_err()
    }) {
        assert!(
            std::env::var_os("PHEMIOS_REQUIRE_FFMPEG").is_none(),
            "MP3 acceptance requires FFmpeg/FFprobe"
        );
        return;
    }
    live_export("mp3");
}
fn live_export(format: &str) {
    let executable = PathBuf::from(
        std::env::var_os("PHEMIOS_TRANSFER_ENGINE")
            .expect("run tools/check.sh or supply PHEMIOS_TRANSFER_ENGINE"),
    );
    let root = std::env::temp_dir().join(format!(
        "phemios-live-transfer-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir(&root).unwrap();
    let _cleanup = Workspace(root.clone());
    let source = root.join("source");
    let album = source.join("Example Artist").join("Example Album");
    fs::create_dir_all(&album).unwrap();
    let original = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("crates")
        .join("phemios-cd")
        .join("tests")
        .join("fixtures")
        .join("ramp.flac");
    let bytes = fs::read(original).unwrap();
    fs::write(album.join("01.flac"), &bytes).unwrap();
    let engine_root = root.join("local-engine");
    phemios_transfer::run_engine(
        &executable,
        &[
            "scan".into(),
            source.to_str().unwrap().into(),
            format!("--data={}", engine_root.join("engine").display()),
            "--threads=1".into(),
        ],
        &|| Ok(()),
    )
    .unwrap();
    let mut engine = phemios_core::local::Engine::new(engine_root, executable.clone());
    let client = engine.start().unwrap();
    assert!(
        client.account()["server"]
            .as_str()
            .unwrap()
            .starts_with("https://127.0.0.1:")
    );
    let tracks = client
        .request(
            "GET",
            "/api/v1/presentation/tracks",
            &[("limit", "50")],
            None,
        )
        .unwrap();
    let reference = tracks["items"][0]["reference"].as_str().unwrap().to_owned();
    let mut payload = json!({"references":[reference]});
    if format != "original" {
        payload["format"] = json!(format);
    }
    let plan = client
        .request("POST", "/api/me/v1/exports/plan", &[], Some(&payload))
        .unwrap();
    let row = &plan["items"][0];
    let parts: Vec<String> = row["components"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap().to_owned())
        .collect();
    let relative = phemios_transfer::relative(&parts).unwrap();
    let (planned, _) = plan::output(row, &parts, format != "original").unwrap();
    assert_eq!(
        planned,
        relative.with_extension(if format == "original" { "flac" } else { "mp3" })
    );
    let owner = Owner {
        client: client.clone(),
        session: Arc::new(Mutex::new(Some(client))),
        generation: Arc::new(AtomicU64::new(1)),
        ticket: "1".into(),
    };
    let destination = root.join("player");
    fs::create_dir(&destination).unwrap();
    let preview = Preview {
        id: "live".into(),
        target: Target::Mounted(Mounted::capture(destination.clone()).unwrap()),
        items: vec![Item {
            owner,
            reference,
            stamp: row["stamp"].as_str().unwrap().into(),
            relative: relative.clone(),
            bytes: bytes.len() as u64,
        }],
        options: json!({"format":format,"verify":true,"replace":false}),
        bytes: bytes.len() as u64,
    };
    let transfer = Transfers::default();
    execute(&transfer, &preview, &executable, &root.join("staging")).unwrap();
    let final_path = destination.join(&planned);
    if format == "original" {
        assert_eq!(fs::read(&final_path).unwrap(), bytes);
    } else {
        assert!(!destination.join(&relative).exists());
        let encoded = std::fs::read(&final_path).unwrap();
        assert!(!encoded.is_empty());
        let probe = std::process::Command::new("ffprobe")
            .args([
                "-v",
                "error",
                "-select_streams",
                "a:0",
                "-show_entries",
                "stream=codec_name",
                "-of",
                "default=nw=1:nk=1",
            ])
            .arg(&final_path)
            .output()
            .unwrap();
        assert!(probe.status.success());
        assert_eq!(String::from_utf8_lossy(&probe.stdout).trim(), "mp3");
    }
    assert_eq!(fs::read(album.join("01.flac")).unwrap(), bytes);
    engine.stop().unwrap();
}
