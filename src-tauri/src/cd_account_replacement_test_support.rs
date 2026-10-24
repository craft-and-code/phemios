//! Keep the exact same-account authority live while replacing only its bearer credential.
use phemios_core::network::Client;
use serde_json::json;
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

pub(super) struct Server {
    address: String,
    stopped: Arc<AtomicBool>,
    worker: Option<JoinHandle<Vec<String>>>,
}
impl Server {
    pub(super) fn finish(mut self) -> Vec<String> {
        self.stop();
        self.worker.take().unwrap().join().unwrap()
    }
    fn stop(&self) {
        self.stopped.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(&self.address);
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

/// Real logins retain identical public identity and authority, with two distinct fixture tokens.
pub(super) fn sessions() -> (Client, Client, Server) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap().to_string();
    let authority = format!("http://{address}");
    let stopped = Arc::new(AtomicBool::new(false));
    let stop = stopped.clone();
    let worker = std::thread::spawn(move || {
        let mut logins = 0;
        let mut requests = Vec::new();
        loop {
            let (mut stream, _) = listener.accept().unwrap();
            if stop.load(Ordering::SeqCst) {
                return requests;
            }
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            stream
                .set_write_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            while !bytes.ends_with(b"\r\n\r\n") {
                assert!(bytes.len() < 8192, "bounded fixture headers");
                let mut byte = [0];
                stream.read_exact(&mut byte).unwrap();
                bytes.push(byte[0]);
            }
            let headers = String::from_utf8(bytes).unwrap();
            let request = headers.lines().next().unwrap();
            let route = request
                .split_whitespace()
                .take(2)
                .collect::<Vec<_>>()
                .join(" ");
            requests.push(route.clone());
            let length = headers
                .lines()
                .find_map(|line| {
                    let (name, value) = line.split_once(':')?;
                    name.eq_ignore_ascii_case("content-length")
                        .then(|| value.trim().parse::<usize>().unwrap())
                })
                .unwrap_or(0);
            assert!(length < 2048, "bounded login body");
            stream.read_exact(&mut vec![0; length]).unwrap();
            let body = match route.as_str() {
                "POST /api/auth/v1/session" => {
                    let token = ['a', 'b'][logins];
                    logins += 1;
                    json!({"token":token.to_string().repeat(64),"account":{"id":"fixture","role":"user"}})
                }
                "GET /api/auth/v1/session" => {
                    assert_eq!(logins, 2);
                    assert!(headers.to_ascii_lowercase().contains(&format!("authorization: bearer {}", "a".repeat(64))), "only the first captured login may dispatch its live admission");
                    json!({"id":"fixture","role":"user","enabled":true})
                }
                _ => panic!("unexpected credential-replacement fixture route"),
            }.to_string();
            write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
        }
    });
    let first = Client::login(&authority, "fixture", "fictional-password").unwrap();
    let second = Client::login(&authority, "fixture", "fictional-password").unwrap();
    assert_eq!(first.account(), second.account());
    assert!(!first.same_session(&second));
    (
        first,
        second,
        Server {
            address,
            stopped,
            worker: Some(worker),
        },
    )
}
