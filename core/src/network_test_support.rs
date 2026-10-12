//! Test-only authenticated client for isolated loopback transports.
pub(crate) fn client(server: String) -> super::Client {
    super::Client {
        agent: super::agent(),
        server,
        token: "fictional".into(),
        account: serde_json::json!({"account":{"role":"user"}}),
    }
}

/// Finite isolated replies fail with a bounded timeout instead of hanging after an omitted read.
pub(crate) fn replies(
    rows: Vec<(&'static str, serde_json::Value)>,
) -> (String, std::thread::JoinHandle<()>) {
    use std::io::{Read, Write};
    use std::time::{Duration, Instant};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let authority = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        for (path, reply) in rows {
            let deadline = Instant::now() + Duration::from_secs(5);
            let (mut stream, _) = loop {
                match listener.accept() {
                    Ok(stream) => break stream,
                    Err(error)
                        if error.kind() == std::io::ErrorKind::WouldBlock
                            && Instant::now() < deadline =>
                    {
                        std::thread::sleep(Duration::from_millis(2))
                    }
                    Err(error) => panic!("missing snapshot read: {error}"),
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
            assert!(
                String::from_utf8(header)
                    .unwrap()
                    .starts_with(&format!("GET {path}?"))
            );
            let body = reply.to_string();
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
        }
    });
    (authority, worker)
}
