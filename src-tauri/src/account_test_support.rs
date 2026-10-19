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

/// A successful login followed by the current server-side role/owner snapshot.
pub(crate) fn rechecked_session(current: Value) -> (Client, std::thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let server = format!("http://{}", listener.local_addr().unwrap());
    listener.set_nonblocking(true).unwrap();
    let worker = std::thread::spawn(move || {
        for login in [true, false] {
            let deadline = std::time::Instant::now() + Duration::from_secs(5);
            let (mut stream, _) = loop {
                match listener.accept() {
                    Ok(connection) => break connection,
                    Err(error)
                        if error.kind() == std::io::ErrorKind::WouldBlock
                            && std::time::Instant::now() < deadline =>
                    {
                        std::thread::sleep(Duration::from_millis(2));
                    }
                    Err(error) => panic!("missing fixture request: {error}"),
                }
            };
            stream.set_nonblocking(false).unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut headers = Vec::new();
            while !headers.ends_with(b"\r\n\r\n") {
                assert!(headers.len() < 8192);
                let mut byte = [0];
                stream.read_exact(&mut byte).unwrap();
                headers.push(byte[0]);
            }
            let headers = String::from_utf8(headers).unwrap();
            if login {
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
                stream.read_exact(&mut vec![0; length]).unwrap();
            } else {
                assert!(headers.starts_with("GET /api/auth/v1/session HTTP/1.1"));
                assert!(
                    headers
                        .to_ascii_lowercase()
                        .contains(&format!("authorization: bearer {}", "a".repeat(64)))
                );
            }
            let body = if login {
                json!({"token":"a".repeat(64),"account":{"id":"fixture","role":"user"}})
            } else {
                current.clone()
            }
            .to_string();
            write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
        }
    });
    (
        Client::login(&server, "fixture", "fictional-password").unwrap(),
        worker,
    )
}
