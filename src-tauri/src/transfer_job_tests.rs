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
fn streamed_copy(format: &str, extension: &str) {
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
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        for index in 0..2 {
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
            if index == 0 {
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
            } else {
                assert!(headers.starts_with("GET /api/me/v1/exports/original?"));
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
    let relative = Path::new("Example Artist")
        .join("Example Album")
        .join("01.wav");
    let preview = Preview {
        id: "test".into(),
        target: Target::Mounted(Mounted::capture_folder(destination.clone()).unwrap()),
        items: vec![Item {
            owner,
            reference: "track:fixture".into(),
            stamp: "fixture-stamp".into(),
            relative: relative.clone(),
            bytes: original.len() as u64,
        }],
        options: json!({"format":format,"verify":true,"replace":false}),
        bytes: original.len() as u64,
    };
    let state = Transfers::default();
    execute(
        &state,
        &preview,
        Path::new(&executable),
        &root.join("staging"),
    )
    .unwrap();
    worker.join().unwrap();
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
