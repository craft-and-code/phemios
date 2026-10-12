//! Fictional loopback clients for exact native-session admission tests.
use phemios_core::network::Client;
use serde_json::{Value, json};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::Duration;

// Use real Client admission with two fixture-only credentials for the same account/authority.
pub(crate) fn sessions() -> (Client, Client) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let server = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        for token in ['a', 'b'] {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut request = Vec::new();
            while !request.ends_with(b"\r\n\r\n") {
                assert!(request.len() < 8192, "bounded fixture request");
                let mut byte = [0];
                stream.read_exact(&mut byte).unwrap();
                request.push(byte[0]);
            }
            let headers = String::from_utf8(request).unwrap();
            assert!(headers.starts_with("POST /api/auth/v1/session HTTP/1.1"));
            let length: usize = headers
                .lines()
                .find_map(|line| {
                    let (key, value) = line.split_once(':')?;
                    key.eq_ignore_ascii_case("content-length")
                        .then(|| value.trim().parse().unwrap())
                })
                .unwrap();
            assert!(length < 2048);
            let mut body = vec![0; length];
            stream.read_exact(&mut body).unwrap();
            let body: Value = serde_json::from_slice(&body).unwrap();
            assert_eq!(body["username"], "fixture");
            let response = json!({
                "token": token.to_string().repeat(64),
                "account": {"id": "fixture", "role": "user"}
            })
            .to_string();
            write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", response.len(), response).unwrap();
        }
    });
    let first = Client::login(&server, "fixture", "fictional-password").unwrap();
    let second = Client::login(&server, "fixture", "fictional-password").unwrap();
    worker.join().unwrap();
    assert_eq!(first.account(), second.account());
    assert!(!first.same_session(&second));
    (first, second)
}
