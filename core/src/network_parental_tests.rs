use super::*;
use serde_json::json;
#[test]
fn status_cannot_cross_an_owner_or_treat_malformed_control_as_unrestricted() {
    let status = json!({"owner":"child","revision":1,"policy":{"enabled":false},"allowed":true});
    assert!(validate(&status, "child").is_ok());
    assert!(validate(&status, "other").is_err());
    let mut broken = status;
    broken["policy"]["enabled"] = Value::Null;
    assert!(validate(&broken, "child").is_err());
}

#[test]
fn a_restored_policy_cannot_admit_a_stale_snapshot_with_the_same_revision() {
    let status = json!({"owner":"child", "revision":1, "policy":{"enabled":true,"blocked_artists":["artist:hidden"]}});
    let mut snapshot = json!({"accountId":"child", "parentalEnabled":true,"parentalRevision":1,"parentalPolicy":status["policy"]});
    assert!(admit(&status, &snapshot, "child").is_ok());
    snapshot["parentalPolicy"]["blocked_artists"] = json!([]);
    assert!(admit(&status, &snapshot, "child").is_err());
    snapshot["parentalPolicy"] = status["policy"].clone();
    assert!(admit(&status, &snapshot, "other").is_err());
}

#[test]
fn typed_parental_errors_are_readable_without_echoing_server_controlled_text() {
    let detail = json!({"error":{"code":"parental_daily_limit","message":"private server text"}});
    let message = super::super::errors::request_failure(
        403,
        "POST",
        "/api/me/v1/parental/lease",
        false,
        Some(&detail),
    );
    assert!(message.contains("maximale du jour"));
    assert!(!message.contains("private server text"));
    let unknown = json!({"error":{"code":"parental_arbitrary","message":"private server text"}});
    assert!(
        !super::super::errors::request_failure(
            403,
            "POST",
            "/api/me/v1/parental/lease",
            false,
            Some(&unknown)
        )
        .contains("private server text")
    );
}

fn login_reply(token: char) -> Value {
    json!({"token":token.to_string().repeat(64),"account":{"id":"child","role":"user","parental_enabled":false}})
}
fn status_reply(enabled: bool) -> Value {
    json!({"owner":"child","revision":1,"policy":{"enabled":enabled},"allowed":true})
}
fn artwork_replies(
    rows: Vec<(&'static str, u16, Value)>,
) -> (
    String,
    std::sync::Arc<std::sync::atomic::AtomicUsize>,
    std::thread::JoinHandle<()>,
) {
    use std::io::{Read, Write};
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::{Duration, Instant};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let authority = format!("http://{}", listener.local_addr().unwrap());
    let count = std::sync::Arc::new(AtomicUsize::new(0));
    let read_count = count.clone();
    let worker = std::thread::spawn(move || {
        for (line, status, reply) in rows {
            let deadline = Instant::now() + Duration::from_secs(5);
            let (mut stream, _) = loop {
                match listener.accept() {
                    Ok(stream) => break stream,
                    Err(error)
                        if error.kind() == std::io::ErrorKind::WouldBlock
                            && Instant::now() < deadline =>
                    {
                        std::thread::sleep(Duration::from_millis(2));
                    }
                    Err(error) => panic!("missing artwork status read: {error}"),
                }
            };
            stream.set_nonblocking(false).unwrap();
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
            assert!(header.starts_with(line), "unexpected request: {header}");
            let length = header
                .lines()
                .find_map(|line| {
                    let (key, value) = line.split_once(':')?;
                    key.eq_ignore_ascii_case("content-length")
                        .then(|| value.trim().parse::<usize>().unwrap())
                })
                .unwrap_or(0);
            stream.read_exact(&mut vec![0; length]).unwrap();
            read_count.fetch_add(1, Ordering::SeqCst);
            let body = reply.to_string();
            write!(
                stream,
                "HTTP/1.1 {status} Reply\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
        }
    });
    (authority, count, worker)
}

#[test]
fn artwork_status_is_shared_only_by_clones_of_one_authenticated_session() {
    use std::sync::atomic::Ordering;
    let (server, count, worker) = artwork_replies(vec![
        ("POST /api/auth/v1/session", 200, login_reply('a')),
        ("GET /api/me/v1/parental", 200, status_reply(false)),
        ("POST /api/auth/v1/session", 200, login_reply('b')),
        ("GET /api/me/v1/parental", 200, status_reply(false)),
    ]);
    let first = Client::login(&server, "fictional", "fixture-password").unwrap();
    let cloned = first.clone();
    for _ in 0..1000 {
        first.admit_artwork_snapshot(&json!({})).unwrap();
        cloned.admit_artwork_snapshot(&json!({})).unwrap();
    }
    assert_eq!(count.load(Ordering::SeqCst), 2);
    let successor = Client::login(&server, "fictional", "fixture-password").unwrap();
    assert!(!successor.same_session(&first));
    successor.admit_artwork_snapshot(&json!({})).unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 4);
    worker.join().unwrap();
}

#[test]
fn artwork_cache_never_admits_snapshot_download_or_output_operations() {
    use std::sync::atomic::Ordering;
    let (server, count, worker) = artwork_replies(vec![
        ("POST /api/auth/v1/session", 200, login_reply('a')),
        ("GET /api/me/v1/parental", 200, status_reply(false)),
        ("GET /api/me/v1/parental", 200, status_reply(true)),
        ("GET /api/me/v1/parental", 200, status_reply(true)),
        ("GET /api/me/v1/parental", 200, status_reply(true)),
    ]);
    let client = Client::login(&server, "fictional", "fixture-password").unwrap();
    client.admit_artwork_snapshot(&json!({})).unwrap();
    assert!(client.admit_snapshot(&json!({})).is_err());
    assert!(client.require_unrestricted_download().is_err());
    assert!(client.require_unrestricted_output().is_err());
    assert_eq!(count.load(Ordering::SeqCst), 5);
    worker.join().unwrap();
}

#[test]
fn expired_artwork_status_fails_closed_and_errors_are_not_cached() {
    use std::sync::atomic::Ordering;
    use std::time::{Duration, Instant};
    let (server, count, worker) = artwork_replies(vec![
        ("POST /api/auth/v1/session", 200, login_reply('a')),
        ("GET /api/me/v1/parental", 200, status_reply(false)),
        ("GET /api/me/v1/parental", 401, json!({})),
        ("GET /api/me/v1/parental", 200, status_reply(true)),
    ]);
    let client = Client::login(&server, "fictional", "fixture-password").unwrap();
    client.admit_artwork_snapshot(&json!({})).unwrap();
    client.artwork_parental.lock().unwrap().as_mut().unwrap().0 =
        Instant::now() - Duration::from_secs(1);
    assert!(client.admit_artwork_snapshot(&json!({})).is_err());
    assert!(client.artwork_parental.lock().unwrap().is_none());
    assert!(client.admit_artwork_snapshot(&json!({})).is_err());
    let snapshot = json!({"accountId":"child","parentalEnabled":true,"parentalRevision":1,"parentalPolicy":{"enabled":true}});
    client.admit_artwork_snapshot(&snapshot).unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 4);
    worker.join().unwrap();
}

#[test]
fn administrator_and_legacy_artwork_admission_never_contact_the_server() {
    for account in [
        json!({"id":"adult","role":"admin","parental_enabled":true}),
        json!({"id":"legacy","role":"user"}),
    ] {
        let mut client = super::super::test_support::client("http://127.0.0.1:1".into());
        client.account = account;
        client.admit_artwork_snapshot(&json!({})).unwrap();
        assert!(client.artwork_parental.lock().unwrap().is_none());
    }
}

#[test]
fn synchronized_full_policy_is_retained_only_for_process_only_supervised_snapshots() {
    for enabled in [false, true] {
        let policy = json!({"enabled":enabled,"blocked_artists":["artist:private-hidden"],"blocked_podcasts":["https://private.example/rss"]});
        let mut status = status_reply(enabled);
        status["policy"] = policy.clone();
        let empty_page = json!({"items":[],"offset":0,"total":0,"scanned_at":42});
        let (server, _, worker) = artwork_replies(vec![
            ("POST /api/auth/v1/session", 200, login_reply('a')),
            ("GET /api/me/v1/parental", 200, status.clone()),
            ("GET /api/v1/presentation/artists", 200, empty_page.clone()),
            ("GET /api/v1/presentation/albums", 200, empty_page.clone()),
            ("GET /api/v1/presentation/tracks", 200, empty_page.clone()),
            ("GET /api/v1/labels", 200, empty_page),
            ("GET /api/me/v1/parental", 200, status),
        ]);
        let client = Client::login(&server, "fictional", "fixture-password").unwrap();
        let snapshot = client.snapshot().unwrap();
        if enabled {
            assert_eq!(snapshot["parentalEnabled"], true);
            assert_eq!(snapshot["parentalRevision"], 1);
            assert_eq!(snapshot["parentalPolicy"], policy);
        } else {
            assert!(snapshot.get("parentalPolicy").is_none());
            assert!(snapshot.get("parentalEnabled").is_none());
            assert!(snapshot.get("parentalRevision").is_none());
        }
        worker.join().unwrap();
    }
}
