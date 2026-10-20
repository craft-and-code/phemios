//! Controlled busy reply with observable subsequent requests; never contacts a real server.
use super::*;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender};
use std::time::Instant;

pub(super) struct BusyServer {
    pub(super) client: Client,
    pub(super) current: Arc<AtomicBool>,
    pub(super) stop: Sender<()>,
    pub(super) worker: std::thread::JoinHandle<Vec<String>>,
}
/// Retire admission before the first busy response; a second request would receive valid data.
pub(super) fn busy(status: u16) -> BusyServer {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let server = format!("http://{}", listener.local_addr().unwrap());
    let current = Arc::new(AtomicBool::new(true));
    let retired = current.clone();
    let (stop, stopped) = mpsc::channel();
    let worker = std::thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_secs(5);
        let mut paths = Vec::new();
        loop {
            if stopped.try_recv().is_ok() {
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
                Err(error) => panic!("missing request admission: {error}"),
            };
            stream.set_nonblocking(false).unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            stream
                .set_write_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            let mut header = Vec::new();
            while !header.ends_with(b"\r\n\r\n") {
                assert!(header.len() < 8192);
                let mut byte = [0];
                stream.read_exact(&mut byte).unwrap();
                header.push(byte[0]);
            }
            let header = String::from_utf8(header).unwrap();
            assert!(header.starts_with("GET /api/"));
            assert!(
                header
                    .to_ascii_lowercase()
                    .contains("authorization: bearer fictional")
            );
            paths.push(header.split_whitespace().nth(1).unwrap().to_owned());
            if paths.len() == 1 {
                retired.store(false, Ordering::SeqCst);
                write!(
                    stream,
                    "HTTP/1.1 {status} Busy\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                )
                .unwrap();
            } else {
                let image = paths.last().unwrap().starts_with("/api/v1/artwork?");
                let bytes: &[u8] = if image {
                    b"\x89PNG\r\n\x1a\n"
                } else {
                    br#"{"owner":"fixture","revision":1,"policy":{"enabled":false},"allowed":true}"#
                };
                write!(
                    stream,
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    bytes.len()
                )
                .unwrap();
                stream.write_all(bytes).unwrap();
            }
        }
    });
    BusyServer {
        client: Client {
            artwork_parental: Arc::default(),
            agent: agent(),
            playback_tls: None,
            server,
            token: "fictional".into(),
            account: json!({"id":"fixture","role":"user","parental_enabled":false}),
        },
        current,
        stop,
        worker,
    }
}
