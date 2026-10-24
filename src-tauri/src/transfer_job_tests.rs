use super::*;
#[test]
fn copy_options_cannot_enable_arbitrary_tools_or_unknown_behaviour() {
    options(&json!({"format":"original","verify":true,"replace":false})).unwrap();
    for invalid in [
        json!({"format":"shell","verify":true,"replace":false}),
        json!({"format":"mp3","verify":"yes","replace":false}),
        json!({"format":"mp3","verify":true,"replace":false,"delete":true}),
    ] {
        assert!(options(&invalid).is_err());
    }
}
#[test]
fn retired_session_hides_personal_transfer_names_and_cancels_future_work() {
    let (first, second) = crate::account_test_support::sessions();
    let session = Arc::new(Mutex::new(Some(first.clone())));
    let owner = Owner {
        client: first,
        session: session.clone(),
        generation: Arc::new(AtomicU64::new(3)),
        ticket: "3".into(),
    };
    let transfer = Transfers::default();
    *transfer.owners.lock().unwrap() = vec![owner];
    transfer.update(json!({"phase":"copying","current":"Private selection"}));
    transfer.running.store(true, Ordering::Release);
    assert_eq!(transfer.status().unwrap()["current"], "Private selection");
    *session.lock().unwrap() = Some(second);
    let status = transfer.status().unwrap();
    assert_eq!(status["phase"], "idle");
    assert!(status.get("current").is_none());
    assert!(transfer.cancel.load(Ordering::Acquire));
}

#[test]
fn real_engine_copies_and_verifies_a_streamed_original_without_touching_source_or_other_files() {
    streamed_copy("original", "wav");
}
#[test]
fn real_engine_converts_streamed_audio_to_mp3_without_modifying_the_source() {
    if ["ffmpeg", "ffprobe"].iter().any(|tool| {
        std::process::Command::new(tool)
            .arg("-version")
            .output()
            .is_err()
    }) {
        assert!(
            std::env::var_os("PHEMIOS_REQUIRE_FFMPEG").is_none(),
            "MP3 acceptance requires installed FFmpeg and FFprobe"
        );
        eprintln!("MP3 transfer acceptance not run: FFmpeg/FFprobe unavailable");
        return;
    }
    streamed_copy("mp3", "mp3");
}
#[test]
fn a_watched_root_returning_during_download_cannot_be_overwritten() {
    streamed_copy_case("original", "wav", true);
}
fn streamed_copy(format: &str, extension: &str) {
    streamed_copy_case(format, extension, false);
}
fn streamed_copy_case(format: &str, extension: &str, returning: bool) {
    use std::io::{Read, Write};
    let executable = std::env::var_os("PHEMIOS_TRANSFER_ENGINE")
        .expect("run tools/check.sh or set PHEMIOS_TRANSFER_ENGINE to the tested Aède binary");
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("crates")
        .join("phemios-cd")
        .join("tests")
        .join("fixtures")
        .join("ramp.wav");
    let bytes = fs::read(&fixture).unwrap();
    let original = bytes.clone();
    let mut random = [0; 16];
    getrandom_bytes(&mut random).unwrap();
    let root = std::env::temp_dir().join(format!(
        "phemios-transfer-e2e-{}",
        random
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    ));
    fs::create_dir(&root).unwrap();
    let _root = Workspace(root.clone());
    let destination = root.join("destination");
    fs::create_dir(&destination).unwrap();
    fs::write(destination.join("existing.txt"), b"retain").unwrap();
    let watched = destination.join("Example Artist");
    let victim = watched.join("Example Album/01.wav");
    let mut retained = original.clone();
    *retained.last_mut().unwrap() ^= 0x55;
    let restore = returning.then(|| (victim.clone(), retained.clone()));
    let mount = Mounted::capture_folder(destination.clone()).unwrap();
    let roots = if returning {
        vec![watched.to_string_lossy().into_owned()]
    } else {
        vec![]
    };
    mount.outside(&roots).unwrap();
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        // Transfer admission and original export each recheck the captured named account.
        for index in 0..4 {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(std::time::Duration::from_secs(5)))
                .unwrap();
            let mut request = Vec::new();
            while !request.ends_with(b"\r\n\r\n") {
                let mut byte = [0];
                stream.read_exact(&mut byte).unwrap();
                request.push(byte[0]);
                assert!(request.len() < 8192);
            }
            let headers = String::from_utf8(request).unwrap();
            if index != 0 {
                let authorization = headers.lines().find_map(|line| {
                    let (name, value) = line.split_once(':')?;
                    name.eq_ignore_ascii_case("authorization")
                        .then(|| value.trim())
                });
                let expected = format!("Bearer {}", "a".repeat(64));
                assert_eq!(authorization, Some(expected.as_str()));
            }
            if index == 0 {
                assert_eq!(
                    headers.lines().next(),
                    Some("POST /api/auth/v1/session HTTP/1.1")
                );
                let length: usize = headers
                    .lines()
                    .find_map(|line| {
                        line.split_once(':')
                            .filter(|(k, _)| k.eq_ignore_ascii_case("content-length"))
                            .map(|(_, v)| v.trim().parse().unwrap())
                    })
                    .unwrap();
                let mut body = vec![0; length];
                stream.read_exact(&mut body).unwrap();
                let response =
                    json!({"token":"a".repeat(64),"account":{"id":"example","role":"admin"}})
                        .to_string();
                write!(
                    stream,
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response}",
                    response.len()
                )
                .unwrap();
            } else if matches!(index, 1 | 2) {
                assert_eq!(
                    headers.lines().next(),
                    Some("GET /api/auth/v1/session HTTP/1.1")
                );
                let response = json!({"id":"example","role":"admin","enabled":true}).to_string();
                write!(
                    stream,
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response}",
                    response.len()
                )
                .unwrap();
            } else {
                assert!(headers.starts_with("GET /api/me/v1/exports/original?"));
                if let Some((path, bytes)) = &restore {
                    fs::create_dir_all(path.parent().unwrap()).unwrap();
                    fs::write(path, bytes).unwrap();
                }
                write!(
                    stream,
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    bytes.len()
                )
                .unwrap();
                stream.write_all(&bytes).unwrap();
            }
        }
    });
    let client = Client::login(&address, "example", "fictional passphrase").unwrap();
    let owner = Owner {
        client: client.clone(),
        session: Arc::new(Mutex::new(Some(client))),
        generation: Arc::new(AtomicU64::new(1)),
        ticket: "1".into(),
    };
    let relative = Path::new("Example Artist")
        .join("Example Album")
        .join("01.wav");
    let preview = Preview {
        id: "test".into(),
        protection: Some(
            roots::Protection::capture(
                &mount,
                Arc::new(Mutex::new(phemios_core::local::Engine::new(
                    root.join("profile"),
                    PathBuf::from(&executable),
                ))),
                &[],
                &roots,
            )
            .unwrap(),
        ),
        target: Target::Mounted(mount),
        items: vec![Item {
            owner,
            reference: "track:fixture".into(),
            stamp: "fixture-stamp".into(),
            relative: relative.clone(),
            bytes: original.len() as u64,
        }],
        options: json!({"format":format,"verify":true,"replace":returning}),
        bytes: original.len() as u64,
    };
    let state = Transfers::default();
    let result = execute(
        &state,
        &preview,
        Path::new(&executable),
        &root.join("staging"),
    );
    worker.join().unwrap();
    if returning {
        assert!(
            fs::read(&victim).unwrap() == retained,
            "copy overwrote audio in the returning watched root"
        );
        assert!(
            result.is_err(),
            "a returning overlapping root must retire the preview"
        );
        assert_eq!(fs::read(&fixture).unwrap(), original);
        assert_eq!(fs::read_dir(root.join("staging")).unwrap().count(), 0);
        return;
    }
    result.unwrap();
    let final_path = destination.join(relative.with_extension(extension));
    let written = fs::read(&final_path).unwrap();
    if format == "original" {
        assert_eq!(written, original);
    } else {
        assert_ne!(written, original);
        assert!(!destination.join(&relative).exists());
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
    assert_eq!(
        fs::read(destination.join("existing.txt")).unwrap(),
        b"retain"
    );
    assert_eq!(fs::read(&fixture).unwrap(), original);
    assert_eq!(state.status().unwrap()["done"], 1);
    assert_eq!(fs::read_dir(root.join("staging")).unwrap().count(), 0);
}

#[test]
fn a_local_root_added_after_preview_refuses_start_before_staging_or_export() {
    let mut random = [0; 16];
    getrandom_bytes(&mut random).unwrap();
    let path = std::env::temp_dir().join(format!(
        "phemios-start-{}",
        random
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    ));
    fs::create_dir(&path).unwrap();
    let _cleanup = Workspace(path.clone());
    let dest = path.join("destination");
    fs::create_dir(&dest).unwrap();
    let mount = Mounted::capture_folder(dest.clone()).unwrap();
    let engine = Arc::new(Mutex::new(phemios_core::local::Engine::new(
        path.join("profile"),
        PathBuf::from("not-an-engine"),
    )));
    let protection = roots::Protection::capture(&mount, engine.clone(), &[], &[]).unwrap();
    let (client, _) = crate::account_test_support::sessions();
    let owner = Owner {
        client: client.clone(),
        session: Arc::new(Mutex::new(Some(client))),
        generation: Arc::new(AtomicU64::new(1)),
        ticket: "1".into(),
    };
    let preview = Preview {
        id: "prepared".into(),
        target: Target::Mounted(mount),
        protection: Some(protection),
        items: vec![Item {
            owner,
            reference: "track:not-dispatched".into(),
            stamp: "stamp".into(),
            relative: PathBuf::from("01.wav"),
            bytes: 1,
        }],
        options: json!({"format":"original","verify":true,"replace":true}),
        bytes: 1,
    };
    engine
        .lock()
        .unwrap()
        .add_roots(&[dest.join("new-local-library")])
        .unwrap();
    assert!(preview.confirm_destination().is_err());
    let staging = path.join("staging");
    assert!(
        execute(
            &Transfers::default(),
            &preview,
            Path::new("not-an-engine"),
            &staging
        )
        .is_err()
    );
    assert!(!staging.exists());
    assert!(fs::read_dir(dest).unwrap().next().is_none());
}
