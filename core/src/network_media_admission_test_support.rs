//! Deterministic loopback replies for named-account media admission; no provider or audio IO.
use serde_json::{Value, json};
use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    thread::JoinHandle,
    time::Duration,
};

pub(crate) struct Reply {
    pub(crate) status: u16,
    pub(crate) body: Value,
}
impl Reply {
    pub(crate) fn ok(body: Value) -> Self {
        Self { status: 200, body }
    }
    pub(crate) fn refused(status: u16) -> Self {
        Self {
            status,
            body: json!({}),
        }
    }
}
pub(crate) fn account(role: &str, marker: Option<bool>) -> Value {
    let mut value =
        json!({"id":"media-owner","username":"fixture-listener","role":role,"enabled":true});
    if let Some(marker) = marker {
        value["parental_enabled"] = marker.into();
    }
    value
}
pub(crate) fn policy(enabled: bool) -> Value {
    json!({"owner":"media-owner","revision":1,"policy":{"enabled":enabled},"allowed":true})
}

pub(crate) struct Server {
    pub(crate) url: String,
    stopped: Arc<AtomicBool>,
    worker: Option<JoinHandle<Vec<String>>>,
}
impl Server {
    pub(crate) fn finish(mut self) -> Vec<String> {
        self.stop();
        self.worker.take().unwrap().join().unwrap()
    }
    fn stop(&self) {
        self.stopped.store(true, Ordering::SeqCst);
        // Wake accept without timers, polling or an extra application request.
        let _ = TcpStream::connect(self.url.strip_prefix("http://").unwrap());
    }
}
impl Drop for Server {
    fn drop(&mut self) {
        if let Some(worker) = self.worker.take() {
            self.stop();
            worker.join().unwrap();
        }
    }
}

pub(crate) fn serve(login: Value, session: Reply, parental: Reply) -> Server {
    serve_retiring(login, session, parental, None)
}
pub(crate) fn serve_retiring(
    login: Value,
    session: Reply,
    parental: Reply,
    retirement: Option<(u16, Box<dyn FnOnce() + Send>)>,
) -> Server {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let stopped = Arc::new(AtomicBool::new(false));
    let stop = stopped.clone();
    let worker = std::thread::spawn(move || {
        let mut paths = Vec::new();
        let mut retirement = retirement;
        loop {
            let (mut stream, _) = listener.accept().unwrap();
            if stop.load(Ordering::SeqCst) {
                return paths;
            }
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            stream
                .set_write_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut header = Vec::new();
            while !header.ends_with(b"\r\n\r\n") {
                assert!(header.len() < 8192, "bounded fixture headers");
                let mut byte = [0];
                stream.read_exact(&mut byte).unwrap();
                header.push(byte[0]);
            }
            let header = String::from_utf8(header).unwrap();
            let line = header.lines().next().unwrap();
            let path = line.split_whitespace().nth(1).unwrap().to_owned();
            let length = header
                .lines()
                .find_map(|line| {
                    let (key, value) = line.split_once(':')?;
                    key.eq_ignore_ascii_case("content-length")
                        .then(|| value.trim().parse::<usize>().unwrap())
                })
                .unwrap_or(0);
            assert!(length < 8192, "bounded fixture body");
            stream.read_exact(&mut vec![0; length]).unwrap();
            paths.push(path.clone());
            let (status, value) = if line.starts_with("POST /api/auth/v1/session ") {
                (200, json!({"token":"a".repeat(64),"account":login}))
            } else {
                assert!(
                    header
                        .to_ascii_lowercase()
                        .contains(&format!("authorization: bearer {}", "a".repeat(64)))
                );
                if let Some((status, retire)) = retirement.take() {
                    retire();
                    (status, json!({}))
                } else if path == "/api/auth/v1/session" {
                    (session.status, session.body.clone())
                } else if path == "/api/me/v1/parental" {
                    (parental.status, parental.body.clone())
                } else {
                    panic!("unexpected fixture route");
                }
            };
            let body = value.to_string();
            write!(stream, "HTTP/1.1 {status} Reply\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
        }
    });
    Server {
        url,
        stopped,
        worker: Some(worker),
    }
}
