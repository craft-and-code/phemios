//! Fictional loopback policy replies for native CD admission only.
use phemios_core::network::Client;
use serde_json::{Value, json};
use std::{
    io::{Read, Write},
    net::TcpListener,
    time::{Duration, Instant},
};
pub(super) fn session(role: &str, policy: Option<Value>) -> (Client, std::thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let mut replies = vec![(
        "POST /api/auth/v1/session ",
        json!({"token":"a".repeat(64),"account":{"id":"fixture-cd","role":role,"parental_enabled":false}}),
    )];
    if let Some(policy) = policy {
        replies.push(("GET /api/me/v1/parental ", policy));
    }
    let handle = std::thread::spawn(move || {
        for (line, value) in replies {
            let deadline = Instant::now() + Duration::from_secs(5);
            let (mut stream, _) = loop {
                match listener.accept() {
                    Ok(s) => break s,
                    Err(e)
                        if e.kind() == std::io::ErrorKind::WouldBlock
                            && Instant::now() < deadline =>
                    {
                        std::thread::sleep(Duration::from_millis(2))
                    }
                    Err(e) => panic!("fixture accept: {e}"),
                }
            };
            stream.set_nonblocking(false).unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut header = Vec::new();
            while !header.ends_with(b"\r\n\r\n") {
                assert!(header.len() < 8192);
                let mut b = [0];
                stream.read_exact(&mut b).unwrap();
                header.push(b[0]);
            }
            let text = String::from_utf8(header).unwrap();
            assert!(text.starts_with(line));
            let length: usize = text
                .lines()
                .find_map(|l| {
                    let (k, v) = l.split_once(':')?;
                    k.eq_ignore_ascii_case("content-length")
                        .then(|| v.trim().parse().unwrap())
                })
                .unwrap_or(0);
            assert!(length < 8192);
            let mut body = vec![0; length];
            stream.read_exact(&mut body).unwrap();
            let json = value.to_string();
            write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",json.len(),json).unwrap();
        }
    });
    (
        Client::login(&url, "fixture", "fictional-cd-password").unwrap(),
        handle,
    )
}
