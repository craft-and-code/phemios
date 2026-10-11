//! Owned loopback fixtures expose malformed mirror replies without public network access.
use super::super::Directory;
use serde_json::Value;
use std::{
    io::{Read, Write},
    net::TcpListener,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};
pub(super) struct Fixture {
    address: String,
    requests: Arc<Mutex<Vec<String>>>,
    stop: Arc<AtomicBool>,
    worker: Option<JoinHandle<()>>,
}
impl Fixture {
    pub(super) fn new(first: Value, second: Value, status: u16) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = format!("http://{}", listener.local_addr().unwrap());
        listener.set_nonblocking(true).unwrap();
        let requests = Arc::new(Mutex::new(Vec::new()));
        let stop = Arc::new(AtomicBool::new(false));
        let recorded = requests.clone();
        let stopped = stop.clone();
        let worker = thread::spawn(move || {
            while !stopped.load(Ordering::Acquire) {
                match listener.accept() {
                    Ok((mut socket, _)) => {
                        socket.set_nonblocking(false).unwrap();
                        socket
                            .set_read_timeout(Some(Duration::from_secs(1)))
                            .unwrap();
                        let mut request = Vec::new();
                        let mut chunk = [0u8; 1024];
                        while request.len() < 8192
                            && !request.windows(4).any(|end| end == b"\r\n\r\n")
                        {
                            let length = socket.read(&mut chunk).unwrap();
                            if length == 0 {
                                break;
                            }
                            request.extend_from_slice(&chunk[..length]);
                        }
                        let request = String::from_utf8(request).unwrap();
                        let path = request.split_whitespace().nth(1).unwrap().to_owned();
                        recorded.lock().unwrap().push(path.clone());
                        let body = if path.starts_with("/first/") {
                            &first
                        } else {
                            &second
                        }
                        .to_string();
                        let reply = format!(
                            "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                            body.len()
                        );
                        socket.write_all(reply.as_bytes()).unwrap();
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(1));
                    }
                    Err(error) => panic!("fixture accept failed: {error}"),
                }
            }
        });
        Self {
            address,
            requests,
            stop,
            worker: Some(worker),
        }
    }
    pub(super) fn host(&self) -> String {
        format!("{}/first", self.address)
    }
    pub(super) fn directory(&self) -> Directory {
        Directory {
            // Only this owned fixture may use loopback; the product resolver is public-only.
            agent: ureq::Agent::config_builder()
                .max_redirects(0)
                .proxy(None)
                .build()
                .into(),
            mirrors: vec![
                format!("{}/first", self.address),
                format!("{}/second", self.address),
            ],
            discovered: Some(Instant::now()),
            ..Directory::default()
        }
    }
    pub(super) fn paths(&self) -> Vec<String> {
        self.requests.lock().unwrap().clone()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(worker) = self.worker.take() {
            worker.join().unwrap();
        }
    }
}
