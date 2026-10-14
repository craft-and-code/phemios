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
    assert!(allowed("GET", "/api/me/v1/search"));
    assert!(!allowed("POST", "/api/me/v1/search"));
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
    assert!(allowed("GET", "/api/v1/presentation/analysis"));
    assert!(!allowed("POST", "/api/v1/presentation/analysis"));
    assert!(!allowed("GET", "/api/v1/presentation/analysis/../private"));
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
            // Accepted sockets can inherit O_NONBLOCK on macOS; bound reads explicitly.
            stream.set_nonblocking(false).unwrap();
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

#[test]
fn name_only_collection_edits_have_a_narrow_native_route() {
    assert!(allowed("PATCH", "/api/me/v1/collection"));
    assert!(!allowed("PATCH", "/api/admin/v1/collection"));
    assert!(!allowed("PATCH", "/api/me/v1/collections"));
}
#[test]
fn new_preferences_lyrics_moods_and_waveform_paths_keep_narrow_method_boundaries() {
    assert!(allowed("GET", "/api/me/v1/preferences"));
    assert!(allowed("PATCH", "/api/me/v1/preferences"));
    assert!(!allowed("POST", "/api/me/v1/preferences"));
    assert!(allowed("GET", "/api/v1/waveform"));
    assert!(!allowed("PUT", "/api/v1/waveform"));
    assert!(allowed("GET", "/api/me/v1/moods"));
    assert!(allowed("PUT", "/api/me/v1/moods"));
    assert!(allowed("POST", "/api/admin/v1/lyrics"));
    assert!(!allowed("POST", "/api/me/v1/lyrics"));
}

#[test]
fn achievements_bridge_admits_only_owner_read_and_action_routes() {
    assert!(allowed("GET", "/api/me/v1/achievements"));
    assert!(allowed("POST", "/api/me/v1/achievements"));
    assert!(!allowed("PUT", "/api/me/v1/achievements"));
    assert!(!allowed("DELETE", "/api/me/v1/achievements"));
}

#[test]
fn snapshot_rejects_cumulative_artist_and_album_pages_before_caching() {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let server = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        let payload = "x".repeat(15 * 1024 * 1024);
        for request_index in 0..7 {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            stream
                .set_write_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut header = Vec::new();
            while !header.ends_with(b"\r\n\r\n") {
                let mut byte = [0];
                stream.read_exact(&mut byte).unwrap();
                header.push(byte[0]);
                assert!(header.len() < 8192);
            }
            let (kind, offset, total) = if request_index < 3 {
                ("artists", request_index, 3)
            } else {
                ("albums", request_index - 3, 4)
            };
            let request = String::from_utf8(header).unwrap();
            assert!(request.starts_with(&format!("GET /api/v1/presentation/{kind}?")));
            assert!(request.contains(&format!("offset={offset}")));
            let body = json!({"total":total,"scanned_at":1,"offset":offset,
                "items":[{"ref":format!("{kind}:{offset}"),"metadata":payload}]})
            .to_string();
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            )
            .unwrap();
            stream.write_all(body.as_bytes()).unwrap();
        }
    });
    let client = Client {
        agent: agent(),
        server,
        token: "fictional".into(),
        account: json!({"id":"fixture"}),
    };
    let answer = client.snapshot();
    worker.join().unwrap();
    assert_eq!(
        answer.map(|_| ()).unwrap_err(),
        "Catalogue trop grand pour ce cache."
    );
}

#[test]
fn snapshot_preserves_complete_same_epoch_projections_and_raw_metadata() {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let server = format!("http://{}", listener.local_addr().unwrap());
    let artist = json!({"ref":"artist:fixture","name":"Échos","tags":{"COMMENT":["quoted \"word\"", "line\nline"]}});
    let album = json!({"ref":"release:fixture","artist":"artist:fixture","year":null});
    let expected_artist = artist.clone();
    let expected_album = album.clone();
    let worker = std::thread::spawn(move || {
        for (path, rows) in [
            ("/api/v1/presentation/artists", vec![artist]),
            ("/api/v1/presentation/albums", vec![album]),
            ("/api/v1/presentation/tracks", vec![]),
            ("/api/v1/labels", vec![]),
        ] {
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
            assert!(
                String::from_utf8(header)
                    .unwrap()
                    .starts_with(&format!("GET {path}?"))
            );
            let body =
                json!({"total":rows.len(),"scanned_at":42,"offset":0,"items":rows}).to_string();
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
        }
    });
    let client = Client {
        agent: agent(),
        server: server.clone(),
        token: "fictional".into(),
        account: json!({"id":"fixture"}),
    };
    let snapshot = client.snapshot().unwrap();
    worker.join().unwrap();
    assert_eq!(
        snapshot,
        json!({"artists":[expected_artist],"albums":[expected_album],"tracks":[],"labels":[],"scannedAt":42,"server":server,"accountId":"fixture"})
    );
}

#[test]
fn library_m3u_files_admit_only_read_only_bounded_opaque_ids() {
    let id = format!("m3u-file-{}", "b".repeat(64));
    assert!(allowed("GET", "/api/me/v1/m3u-files"));
    assert!(allowed("GET", &format!("/api/me/v1/m3u-files/{id}")));
    for method in ["POST", "PUT", "DELETE", "PATCH"] {
        assert!(!allowed(method, "/api/me/v1/m3u-files"));
        assert!(!allowed(method, &format!("/api/me/v1/m3u-files/{id}")));
    }
    for suffix in [
        "../../private",
        "m3u-file-abc",
        "m3u-file-/etc",
        "playlist-abc",
    ] {
        assert!(!allowed("GET", &format!("/api/me/v1/m3u-files/{suffix}")));
    }
}

#[test]
fn folder_playlist_errors_translate_known_codes_without_echoing_server_text() {
    for (status, code) in [
        (404, "m3u_file_not_found"),
        (409, "m3u_files_changed"),
        (413, "m3u_files_too_large"),
        (422, "m3u_text_invalid"),
        (422, "m3u_path_invalid"),
        (503, "m3u_files_timeout"),
        (503, "m3u_file_unavailable"),
    ] {
        let detail =
            serde_json::json!({"error":{"code":code,"message":"SECRET /private/untrusted"}});
        let answer =
            errors::request_failure(status, "GET", "/api/me/v1/m3u-files", false, Some(&detail));
        assert!(answer.contains("M3U"));
        assert!(!answer.contains("SECRET"));
        assert!(!answer.contains("untrusted"));
    }
    let detail = serde_json::json!({"error":{"code":"m3u_text_invalid","message":"SECRET"}});
    assert_eq!(
        errors::request_failure(403, "GET", "/api/me/v1/m3u-files", false, Some(&detail)),
        failure(403)
    );
}

#[test]
fn snapshot_retains_exact_public_label_details_without_private_extensions() {
    let label = json!({"reference":"label:fictional","name":"Fictional","release_count":1});
    let biography = json!({"text":"Attributed prose","url":"https://source.example/label","lang":"en","licence":"CC BY-SA","source":"discogs"});
    let page =
        |rows: Vec<Value>| json!({"items":rows,"offset":0,"total":rows.len(),"scanned_at":42});
    let (authority, worker) = test_support::replies(vec![
        ("/api/v1/presentation/artists", page(vec![])),
        ("/api/v1/presentation/albums", page(vec![])),
        (
            "/api/v1/presentation/tracks",
            page(vec![
                json!({"reference":"track:first","title":"First track","personal_note":"private extension must not enter public cache"}),
            ]),
        ),
        ("/api/v1/labels", page(vec![label.clone()])),
        (
            "/api/v1/label",
            json!({"reference":"label:fictional","name":"Fictional","releases":["release:first"],"biography":biography,"personal_note":"private extension must not enter public cache"}),
        ),
        ("/api/v1/labels", page(vec![label])),
    ]);
    let snapshot = test_support::client(authority).snapshot().unwrap();
    worker.join().unwrap();
    assert_eq!(
        snapshot["labels"],
        json!([{"reference":"label:fictional","name":"Fictional","release_count":1,"releases":["release:first"],"biography":biography}])
    );
    assert!(!snapshot.to_string().contains("private extension"));
}
#[test]
fn snapshot_refuses_label_details_from_a_changed_scan_without_publication() {
    let mut replies = Vec::new();
    for _ in 0..3 {
        let page = |rows: Vec<Value>, epoch: u64| json!({"items":rows,"offset":0,"total":rows.len(),"scanned_at":epoch});
        replies.extend([
            ("/api/v1/presentation/artists", page(vec![], 42)),
            ("/api/v1/presentation/albums", page(vec![], 42)),
            ("/api/v1/presentation/tracks", page(vec![], 42)),
            (
                "/api/v1/labels",
                page(
                    vec![
                        json!({"reference":"label:fictional","name":"Fictional","release_count":0}),
                    ],
                    42,
                ),
            ),
            (
                "/api/v1/label",
                json!({"reference":"label:fictional","name":"Fictional","releases":[]}),
            ),
            (
                "/api/v1/labels",
                page(vec![json!({"reference":"label:fictional"})], 43),
            ),
        ]);
    }
    let (authority, worker) = test_support::replies(replies);
    let answer = test_support::client(authority).snapshot();
    worker.join().unwrap();
    assert_eq!(
        answer.unwrap_err(),
        "Le catalogue change pendant la synchronisation. Réessayez."
    );
}
#[test]
fn acoustic_background_paths_are_exact_post_contracts_without_arbitrary_filesystem_routes() {
    for path in [
        "/api/admin/v1/mood-features",
        "/api/me/v1/background-priority",
    ] {
        assert!(allowed("POST", path));
        assert!(!allowed("GET", path));
        assert!(!allowed("DELETE", path));
        assert!(!allowed("POST", &format!("{path}/arbitrary")));
    }
}

#[test]
fn task_cancellation_transmits_no_json_null_in_place_of_an_absent_body() {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let server = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        let mut bytes = Vec::new();
        while !bytes.ends_with(b"\r\n\r\n") {
            let mut byte = [0];
            stream.read_exact(&mut byte).unwrap();
            bytes.push(byte[0]);
            assert!(bytes.len() < 8192);
        }
        let headers = String::from_utf8(bytes).unwrap();
        assert!(headers.starts_with("POST /api/admin/v1/tasks/19/cancel "));
        let length = headers
            .lines()
            .find_map(|line| {
                line.to_ascii_lowercase()
                    .strip_prefix("content-length:")
                    .map(|n| n.trim().parse::<usize>().unwrap())
            })
            .unwrap_or(0);
        let mut body = vec![0; length];
        stream.read_exact(&mut body).unwrap();
        stream
            .write_all(b"HTTP/1.1 202 Accepted\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}")
            .unwrap();
        body
    });
    let client = Client {
        agent: agent(),
        server,
        token: "fictional".into(),
        account: json!({}),
    };
    assert_eq!(
        client
            .request("POST", "/api/admin/v1/tasks/19/cancel", &[], None)
            .unwrap(),
        json!({})
    );
    assert!(worker.join().unwrap().is_empty());
}

#[test]
fn generation_and_completion_routes_admit_only_their_intended_methods() {
    assert!(allowed("POST", "/api/admin/v1/generate"));
    assert!(!allowed("GET", "/api/admin/v1/generate"));
    assert!(allowed("GET", "/api/me/v1/album-listening"));
    assert!(!allowed("PUT", "/api/me/v1/album-listening"));
    assert!(!allowed("POST", "/api/me/v1/album-listening"));
}

#[test]
fn album_decode_route_accepts_only_the_explicit_administrative_post() {
    assert!(allowed("POST", "/api/admin/v1/check"));
    assert!(!allowed("GET", "/api/admin/v1/check"));
}

#[test]
fn artist_logos_request_a_bounded_thumbnail_without_expanding_image_capabilities() {
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
        assert!(request.contains("kind=logo"));
        assert!(request.contains("size=512"));
        stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 8\r\nContent-Type: image/png\r\nConnection: close\r\n\r\n\x89PNG\r\n\x1a\n").unwrap();
    });
    let client = Client {
        agent: agent(),
        server,
        token: "fictional".into(),
        account: json!({}),
    };
    assert_eq!(
        client.artwork("artist:fictional", "logo").unwrap(),
        b"\x89PNG\r\n\x1a\n"
    );
    worker.join().unwrap();
}
