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
    assert!(!allowed("POST", "/api/admin/v1/execute"));
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

#[test]
fn analysis_report_is_a_read_only_scoped_capability() {
    assert!(allowed("GET", "/api/v1/analysis/report"));
    assert!(!allowed("POST", "/api/v1/analysis/report"));
    assert!(!allowed("GET", "/api/v1/analysis/report/../../private"));
}
#[test]
fn collection_evaluation_selection_and_confirmed_reset_have_narrow_capabilities() {
    assert!(allowed("GET", "/api/v1/presentation/playback"));
    assert!(allowed("GET", "/api/me/v1/collection/albums"));
    assert!(allowed("DELETE", "/api/me/v1/history"));
    assert!(!allowed("POST", "/api/me/v1/history"));
    assert!(!allowed("DELETE", "/api/admin/v1/history"));
    assert!(!allowed("PUT", "/api/v1/presentation/playback"));
}

#[test]
fn light_disc_pages_and_capability_reads_remain_read_only() {
    assert!(allowed("GET", "/api/v1/status"));
    assert!(allowed("GET", "/api/v1/presentation/tracks"));
    assert!(!allowed("POST", "/api/v1/presentation/tracks"));
    assert!(!allowed("PUT", "/api/v1/status"));
}
#[test]
fn old_routes_and_name_collisions_are_distinct_from_missing_entities_or_busy_stores() {
    let route = json!({"error":{"code":"not_found","message":"private credential"}});
    assert!(
        errors::request_failure(
            404,
            "GET",
            "/api/v1/presentation/tracks",
            false,
            Some(&route)
        )
        .contains("redémarrez")
    );
    let missing = json!({"error":{"code":"entity_not_found"}});
    assert!(
        !errors::request_failure(
            404,
            "GET",
            "/api/v1/presentation/tracks",
            false,
            Some(&missing)
        )
        .contains("redémarrez")
    );
    let collision = json!({"error":{"code":"collection_exists"}});
    assert!(
        errors::request_failure(409, "PUT", "/api/me/v1/collection", true, Some(&collision))
            .contains("nom")
    );
    assert!(
        !errors::request_failure(409, "PUT", "/api/me/v1/collection", true, None).contains("nom")
    );
    assert!(
        !errors::request_failure(500, "PUT", "/api/me/v1/collection", true, Some(&route))
            .contains("private credential")
    );
}

#[test]
fn spectrum_exports_request_original_dimensions_and_preserve_response_bytes() {
    use std::io::{Read, Write};
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
        let request = String::from_utf8(request).unwrap();
        assert!(request.starts_with("GET /api/v1/artwork?"));
        assert!(request.contains("kind=spectrum"));
        assert!(!request.contains("size="));
        stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 8\r\nContent-Type: image/png\r\nConnection: close\r\n\r\n\x89PNG\r\n\x1a\n").unwrap();
    });
    let client = Client {
        agent: agent(),
        server,
        token: "fictional".into(),
        account: json!({}),
    };
    assert_eq!(
        client.spectrum_download("track:fictional").unwrap(),
        b"\x89PNG\r\n\x1a\n"
    );
    worker.join().unwrap();
}

#[test]
fn settings_routes_do_not_expand_to_arbitrary_admin_paths() {
    assert!(allowed("GET", "/api/v1/roots"));
    assert!(allowed("POST", "/api/admin/v1/scan"));
    assert!(allowed("PATCH", "/api/admin/v1/accounts/listener"));
    assert!(allowed(
        "DELETE",
        "/api/admin/v1/accounts/listener/sessions"
    ));
    assert!(!allowed(
        "PATCH",
        "/api/admin/v1/accounts/listener/../owner"
    ));
    assert!(!allowed("POST", "/api/admin/v1/shell"));
    assert!(!allowed("GET", "https://other.example/api/v1/roots"));
}

#[test]
fn label_reads_and_private_missing_decisions_have_narrow_methods() {
    assert!(allowed("GET", "/api/v1/labels"));
    assert!(allowed("GET", "/api/v1/label"));
    assert!(allowed("GET", "/api/me/v1/missing"));
    assert!(allowed("PUT", "/api/me/v1/missing"));
    assert!(!allowed("DELETE", "/api/v1/label"));
    assert!(!allowed("POST", "/api/me/v1/missing"));
    assert!(!allowed("GET", "/api/me/v1/missing/../../private"));
}

#[test]
fn missing_cover_selectors_refuse_paths_urls_and_invalid_groups_before_network_access() {
    let client = Client {
        agent: agent(),
        server: "http://127.0.0.1:1".into(),
        token: "0".repeat(64),
        account: json!({}),
    };
    for (artist, group) in [
        ("release:any", "12345678-1234-1234-1234-123456789abc"),
        ("https://private/", "12345678-1234-1234-1234-123456789abc"),
        ("artist:signal", "../../private"),
        ("artist:signal", "12345678-1234-1234-1234-123456789abg"),
    ] {
        assert_eq!(
            client.missing_cover(artist, group, true).unwrap_err(),
            "Album manquant Aède invalide."
        );
    }
}

#[test]
fn idempotent_reads_retry_temporary_personal_store_contention() {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let server = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        let mut count = 0;
        while count < 2 && std::time::Instant::now() < deadline {
            let (mut stream, _) = match listener.accept() {
                Ok(value) => value,
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(5));
                    continue;
                }
                Err(error) => panic!("{error}"),
            };
            stream
                .set_read_timeout(Some(Duration::from_secs(1)))
                .unwrap();
            let mut header = Vec::new();
            while !header.ends_with(b"\r\n\r\n") {
                let mut byte = [0];
                stream.read_exact(&mut byte).unwrap();
                header.push(byte[0]);
                assert!(header.len() < 8192);
            }
            assert!(header.starts_with(b"GET /api/v1/status "));
            let (status, body) = if count == 0 {
                ("409 Conflict", r#"{"error":{"code":"store_busy"}}"#)
            } else {
                ("200 OK", r#"{"status":"ok"}"#)
            };
            write!(
                stream,
                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
            count += 1;
        }
        count
    });
    let client = Client {
        agent: agent(),
        server,
        token: "fictional".into(),
        account: json!({}),
    };
    let answer = client.request("GET", "/api/v1/status", &[], None);
    let count = worker.join().unwrap();
    assert_eq!(answer.unwrap()["status"], "ok");
    assert_eq!(count, 2);
}
