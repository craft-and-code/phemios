use super::*;
#[test]
fn credentials_only_go_to_explicit_secure_authorities() {
    for address in [
        "http://192.168.1.2:3412",
        "https://user:secret@example.org",
        "https://example.org/api",
        "https://example.org?token=secret",
        "https://example.org/#private",
        "file:///tmp/library",
    ] {
        assert!(server_address(address).is_err(), "{address}");
    }
    for address in [
        "http://127.0.0.1:3412",
        "http://localhost:3412/",
        "http://[::1]:3412",
        "https://music.example.org",
    ] {
        assert!(server_address(address).is_ok(), "{address}");
    }
}
#[test]
fn bridge_requests_cannot_supply_another_url_or_arbitrary_admin_command() {
    assert!(!allowed("GET", "https://example.org/api/v1/album"));
    assert!(!allowed("POST", "/api/admin/v1/scan"));
    assert!(!allowed("PUT", "/api/admin/v1/accounts"));
    assert!(!allowed("GET", "/api/admin/v1/tasks/1/../../accounts"));
    assert!(allowed("POST", "/api/admin/v1/tasks/42/cancel"));
    assert!(allowed("PUT", "/api/me/v1/annotation"));
}
#[test]
fn server_errors_do_not_echo_secrets_or_untrusted_response_text() {
    assert_eq!(
        failure(401),
        "Session absente ou expirée. Reconnectez-vous."
    );
    assert!(decode(b"not-json").is_err());
    assert_eq!(decode(b"").unwrap(), Value::Null);
}
#[test]
fn transient_artwork_admission_is_retried_before_declaring_a_cover_missing() {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let server = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        for attempt in 0..2 {
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
            let request = String::from_utf8(request).unwrap();
            assert!(request.starts_with("GET /api/v1/artwork?"));
            assert!(
                request
                    .to_ascii_lowercase()
                    .contains("authorization: bearer fictional")
            );
            if attempt == 0 {
                stream.write_all(b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
            } else {
                stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 8\r\nContent-Type: image/png\r\nConnection: close\r\n\r\n\x89PNG\r\n\x1a\n").unwrap();
            }
        }
    });
    let client = Client {
        agent: agent(),
        server,
        token: "fictional".into(),
        account: json!({}),
    };
    assert_eq!(
        client.artwork("release:fictional", "cover").unwrap(),
        b"\x89PNG\r\n\x1a\n"
    );
    worker.join().unwrap();
}

#[test]
fn transient_annotation_read_retries_busy_admission() {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let server = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        for attempt in 0..2 {
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
            let request = String::from_utf8(request).unwrap();
            assert!(request.starts_with("GET /api/me/v1/annotation?"));
            assert!(
                request
                    .to_ascii_lowercase()
                    .contains("authorization: bearer fictional")
            );
            if attempt == 0 {
                stream.write_all(b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
            } else {
                stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 19\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"annotation\":null}").unwrap();
            }
        }
    });
    let client = Client {
        agent: agent(),
        server,
        token: "fictional".into(),
        account: json!({}),
    };
    assert_eq!(
        client
            .request(
                "GET",
                "/api/me/v1/annotation",
                &[("ref", "release:fictional")],
                None
            )
            .unwrap(),
        json!({"annotation":null})
    );
    worker.join().unwrap();
}
#[test]
fn busy_playlist_publication_is_never_replayed() {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let server = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        let mut header = Vec::new();
        while !header.ends_with(b"\r\n\r\n") {
            let mut byte = [0];
            stream.read_exact(&mut byte).unwrap();
            header.push(byte[0]);
            assert!(header.len() < 8192);
        }
        let header = String::from_utf8(header).unwrap();
        assert!(header.starts_with("POST /api/me/v1/m3u "));
        let length: usize = header
            .lines()
            .find_map(|line| {
                line.to_ascii_lowercase()
                    .strip_prefix("content-length: ")
                    .map(str::to_owned)
            })
            .unwrap()
            .parse()
            .unwrap();
        let mut body = vec![0; length];
        stream.read_exact(&mut body).unwrap();
        assert_eq!(
            serde_json::from_slice::<Value>(&body).unwrap()["release"],
            "release:fictional"
        );
        stream.write_all(b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
    });
    let client = Client {
        agent: agent(),
        server,
        token: "fictional".into(),
        account: json!({}),
    };
    assert_eq!(
        client
            .request(
                "POST",
                "/api/me/v1/m3u",
                &[],
                Some(&json!({"release":"release:fictional","name":"Example"}))
            )
            .unwrap_err(),
        "Aède est occupé. Réessayez dans quelques instants."
    );
    worker.join().unwrap();
}

#[test]
fn statistics_and_diagnosis_are_read_only_narrow_capabilities() {
    assert!(allowed("GET", "/api/v1/stats"));
    assert!(allowed("GET", "/api/v1/doctor"));
    assert!(!allowed("POST", "/api/v1/stats"));
    assert!(!allowed("DELETE", "/api/v1/doctor"));
    assert!(!allowed("GET", "/api/v1/stats/../../accounts"));
}

#[test]
fn connection_status_allows_only_reading_the_current_session() {
    assert!(allowed("GET", "/api/auth/v1/session"));
    assert!(!allowed("PUT", "/api/auth/v1/session"));
    assert!(!allowed("GET", "/api/auth/v1/password"));
}
