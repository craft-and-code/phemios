use super::*;
use std::io::{Read, Write};
#[test]
fn original_export_streams_exact_bytes_and_cancellation_never_contacts_another_authority() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let server = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        let mut request = Vec::new();
        while !request.ends_with(b"\r\n\r\n") {
            let mut byte = [0];
            stream.read_exact(&mut byte).unwrap();
            request.push(byte[0]);
            assert!(request.len() < 8192);
        }
        let text = String::from_utf8(request).unwrap();
        assert!(text.starts_with("GET /api/me/v1/exports/original?"));
        assert!(text.contains("stamp="));
        assert!(
            text.to_lowercase()
                .contains("authorization: bearer fictional")
        );
        stream
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 8\r\nConnection: close\r\n\r\noriginal")
            .unwrap();
    });
    let client = Client {
        agent: agent(),
        server,
        token: "fictional".into(),
        account: json!({"role":"admin"}),
        artwork_parental: Arc::default(),
        playback_tls: None,
    };
    let root = std::env::temp_dir().join(format!("phemios-export-test-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let path = root.join("original.wav");
    client
        .export_original("track:example", "size:mtime", 8, &path, &|| Ok(()), &|_| {})
        .unwrap();
    assert_eq!(std::fs::read(&path).unwrap(), b"original");
    worker.join().unwrap();
    assert!(
        client
            .export_original(
                "track:example",
                "size:mtime",
                8,
                &root.join("canceled"),
                &|| Err("canceled".into()),
                &|_| {}
            )
            .is_err()
    );
    assert!(!root.join("canceled").exists());
    std::fs::remove_dir_all(root).unwrap();
    assert!(!allowed("GET", "/api/me/v1/exports/original"));
    assert!(allowed("POST", "/api/me/v1/exports/plan"));
}

#[test]
fn a_progressing_original_can_take_longer_than_fifteen_seconds_to_download() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let server = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let mut request = Vec::new();
        while !request.ends_with(b"\r\n\r\n") {
            let mut byte = [0];
            stream.read_exact(&mut byte).unwrap();
            request.push(byte[0]);
            assert!(request.len() < 8192);
        }
        stream
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 8\r\nConnection: close\r\n\r\n")
            .unwrap();
        for (index, byte) in b"original".iter().enumerate() {
            if index > 0 {
                std::thread::sleep(Duration::from_millis(2400));
            }
            if stream.write_all(&[*byte]).is_err() {
                break;
            }
        }
    });
    let client = Client {
        agent: agent(),
        server,
        token: "fictional".into(),
        account: json!({"role":"admin"}),
        artwork_parental: Arc::default(),
        playback_tls: None,
    };
    let root =
        std::env::temp_dir().join(format!("phemios-slow-export-test-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let path = root.join("original.wav");
    let result = client.export_original("track:example", "stamp", 8, &path, &|| Ok(()), &|_| {});
    worker.join().unwrap();
    let downloaded = std::fs::read(&path).unwrap();
    std::fs::remove_dir_all(root).unwrap();
    assert!(result.is_ok(), "{result:?}");
    assert_eq!(downloaded, b"original");
}
