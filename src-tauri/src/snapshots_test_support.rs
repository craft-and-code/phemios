//! Controlled loopback catalogue requests; no live server or source music is touched.
use phemios_core::network::Client;
use serde_json::json;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::mpsc::{self, Receiver, Sender};
use std::time::{Duration, Instant};

fn headers(stream: &mut TcpStream) -> String {
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    let mut bytes = Vec::new();
    while !bytes.ends_with(b"\r\n\r\n") {
        assert!(bytes.len() < 8192);
        let mut byte = [0];
        stream.read_exact(&mut byte).unwrap();
        bytes.push(byte[0]);
    }
    let headers = String::from_utf8(bytes).unwrap();
    let length = headers
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("content-length")
                .then(|| value.trim().parse::<usize>().unwrap())
        })
        .unwrap_or(0);
    assert!(length <= 2048);
    stream.read_exact(&mut vec![0; length]).unwrap();
    headers
}

/// Hold one selected catalogue request until native account replacement/logout has completed.
pub(crate) struct CatalogServer {
    pub(crate) client: Client,
    pub(crate) replacement: Client,
    pub(crate) pending: Receiver<()>,
    pub(crate) resume: Sender<()>,
    pub(crate) stop: Sender<()>,
    pub(crate) worker: std::thread::JoinHandle<Vec<String>>,
}
pub(crate) fn catalog_server(pause_at: usize) -> CatalogServer {
    catalog_server_status(pause_at, 200)
}
pub(crate) fn catalog_server_status(pause_at: usize, held_status: u16) -> CatalogServer {
    server(pause_at, held_status, None)
}
/// A live user policy lookup can share the same held-response and observed-request fixture.
pub(crate) fn policy_server(held_status: u16, enabled: bool) -> CatalogServer {
    server(1, held_status, Some(enabled))
}
fn server(pause_at: usize, held_status: u16, policy: Option<bool>) -> CatalogServer {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let authority = format!("http://{}", listener.local_addr().unwrap());
    listener.set_nonblocking(true).unwrap();
    let (pending_tx, pending) = mpsc::channel();
    let (resume, resume_rx) = mpsc::channel();
    let (stop, stop_rx) = mpsc::channel();
    let worker = std::thread::spawn(move || {
        let mut paths = Vec::new();
        let mut logins = 0;
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            if stop_rx.try_recv().is_ok() {
                return paths;
            }
            let (mut stream, _) = match listener.accept() {
                Ok(value) => value,
                Err(error)
                    if error.kind() == std::io::ErrorKind::WouldBlock
                        && Instant::now() < deadline =>
                {
                    std::thread::sleep(Duration::from_millis(2));
                    continue;
                }
                Err(error) => panic!("catalogue fixture timed out: {error}"),
            };
            stream.set_nonblocking(false).unwrap();
            stream
                .set_write_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let request = headers(&mut stream);
            let target = request.split_whitespace().nth(1).unwrap().to_owned();
            let body = if request.starts_with("POST /api/auth/v1/session ") {
                let token = if logins == 0 { "a" } else { "b" };
                logins += 1;
                let mut account = json!({"id":"fixture","role":"admin"});
                if let Some(enabled) = policy {
                    account["role"] = json!("user");
                    account["parental_enabled"] = json!(enabled);
                }
                json!({"token":token.repeat(64),"account":account})
            } else {
                assert!(request.starts_with("GET /api/v1/") || request.starts_with("GET /api/auth/v1/session ")
                        || request.starts_with("GET /api/me/v1/parental "));
                paths.push(target.clone());
                if paths.len() == pause_at {
                    pending_tx.send(()).unwrap();
                    resume_rx.recv_timeout(Duration::from_secs(5)).unwrap();
                    if held_status != 200 {
                        write!(stream, "HTTP/1.1 {held_status} Busy\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
                        continue;
                    }
                }
                if target == "/api/me/v1/parental" {
                    let body = json!({"owner":"fixture","revision":1,"policy":{"enabled":policy.unwrap()},"allowed":true}).to_string();
                    write!(stream,"HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
                    continue;
                }
                let artists = target.starts_with("/api/v1/presentation/artists?");
                let offset = if target.contains("offset=200") { 200 } else { 0 };
                let labels = target.starts_with("/api/v1/labels?");
                let detail = target.starts_with("/api/v1/label?");
                if detail {
                    let name = if target.contains("second") { "second" } else { "first" };
                    let body = json!({"reference":format!("label:{name}"),"name":name,"releases":[]}).to_string();
                    write!(stream,"HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
                    continue;
                }
                let rows = if labels {
                    ["first", "second"].map(|name| json!({"reference":format!("label:{name}"),"name":name,"release_count":0})).to_vec()
                } else if artists {
                    (offset..std::cmp::min(offset + 200, 201))
                        .map(|index| json!({"reference":format!("artist:{index}"),"name":format!("Artist {index}")})).collect()
                } else { Vec::new() };
                json!({"items":rows,"total":if artists {201} else if labels {2} else {0},"offset":offset,"scanned_at":1})
            }.to_string();
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
        }
    });
    let client = Client::login(&authority, "fixture", "fictional-password").unwrap();
    let replacement = Client::login(&authority, "fixture", "fictional-password").unwrap();
    assert!(!client.same_session(&replacement));
    CatalogServer {
        client,
        replacement,
        pending,
        resume,
        stop,
        worker,
    }
}
