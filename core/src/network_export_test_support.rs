//! Live authority preflight for retained original-export fixtures; source bytes remain unchanged.
use std::{
    io::{Read, Write},
    net::TcpListener,
    time::Duration,
};

pub(super) fn confirm_session(listener: &TcpListener) {
    let (mut stream, _) = listener.accept().unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(3)))
        .unwrap();
    let mut request = Vec::new();
    while !request.ends_with(b"\r\n\r\n") {
        assert!(request.len() < 8192);
        let mut byte = [0];
        stream.read_exact(&mut byte).unwrap();
        request.push(byte[0]);
    }
    let text = String::from_utf8(request).unwrap();
    assert!(text.starts_with("GET /api/auth/v1/session HTTP/1.1"));
    assert!(
        text.to_ascii_lowercase()
            .contains("authorization: bearer fictional")
    );
    let body = br#"{"id":"fixture","role":"admin","enabled":true}"#;
    write!(
        stream,
        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    )
    .unwrap();
    stream.write_all(body).unwrap();
}
