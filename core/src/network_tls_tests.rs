use super::*;
use rustls::pki_types::PrivatePkcs8KeyDer;
use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    thread,
};

fn identity() -> rcgen::CertifiedKey<rcgen::KeyPair> {
    rcgen::generate_simple_self_signed(vec!["127.0.0.1".into()]).unwrap()
}
fn peer() -> (String, Vec<u8>, thread::JoinHandle<()>) {
    let identity = identity();
    let certificate = identity.cert.der().to_vec();
    let config = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(
            vec![identity.cert.der().clone()],
            PrivatePkcs8KeyDer::from(identity.signing_key.serialize_der()).into(),
        )
        .unwrap();
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = format!("https://{}", listener.local_addr().unwrap());
    let task = thread::spawn(move || {
        // Untrusted default, wrong process certificate, correct HTTPS, then the same identity on WSS.
        for attempt in 0..4 {
            let (socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(std::time::Duration::from_secs(3)))
                .unwrap();
            socket
                .set_write_timeout(Some(std::time::Duration::from_secs(3)))
                .unwrap();
            let mut stream = rustls::StreamOwned::new(
                rustls::ServerConnection::new(Arc::new(config.clone())).unwrap(),
                socket,
            );
            if attempt < 2 {
                assert!(stream.read(&mut [0u8; 1]).is_err());
            } else if attempt == 2 {
                let mut header = Vec::new();
                while !header.ends_with(b"\r\n\r\n") {
                    let mut byte = [0];
                    stream.read_exact(&mut byte).unwrap();
                    header.push(byte[0]);
                    assert!(header.len() < 4096);
                }
                let header = String::from_utf8(header).unwrap();
                let length = header
                    .lines()
                    .find_map(|line| {
                        line.to_ascii_lowercase()
                            .strip_prefix("content-length:")
                            .map(|v| v.trim().parse::<usize>().unwrap())
                    })
                    .unwrap();
                assert!(length < 4096);
                stream.read_exact(&mut vec![0; length]).unwrap();
                let body=serde_json::json!({"token":"a".repeat(64),"account":{"id":"desktop-test","role":"admin"}}).to_string();
                write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
                stream.flush().unwrap();
            } else {
                let mut websocket = tungstenite::accept(stream).unwrap();
                assert_eq!(
                    websocket.read().unwrap().into_text().unwrap(),
                    "verified-wss"
                );
                websocket
                    .send(tungstenite::Message::Text("confirmed".into()))
                    .unwrap();
            }
        }
    });
    (address, certificate, task)
}
#[test]
fn embedded_https_and_wss_trust_only_the_same_process_certificate() {
    let (address, certificate, task) = peer();
    assert!(Client::login(&address, "desktop-test", "fictional-passphrase").is_err());
    assert!(
        Client::login_pinned(
            &address,
            "desktop-test",
            "fictional-passphrase",
            identity().cert.der()
        )
        .is_err()
    );
    let client = Client::login_pinned(
        &address,
        "desktop-test",
        "fictional-passphrase",
        &certificate,
    )
    .unwrap();
    let uri: ureq::http::Uri = address.parse().unwrap();
    let socket = TcpStream::connect(("127.0.0.1", uri.port_u16().unwrap())).unwrap();
    socket
        .set_read_timeout(Some(std::time::Duration::from_secs(3)))
        .unwrap();
    let (mut websocket, _) = tungstenite::client_tls_with_config(
        address.replacen("https:", "wss:", 1),
        socket,
        None,
        client.playback_connector(),
    )
    .unwrap();
    websocket
        .send(tungstenite::Message::Text("verified-wss".into()))
        .unwrap();
    assert_eq!(websocket.read().unwrap().into_text().unwrap(), "confirmed");
    task.join().unwrap();
}
#[test]
fn pinned_identity_cannot_be_used_for_remote_or_unencrypted_authorities() {
    let cert = identity();
    for server in [
        "http://127.0.0.1:1234",
        "https://example.invalid:1234",
        "https://127.0.0.1:0",
    ] {
        assert!(
            Client::login_pinned(
                server,
                "desktop-test",
                "fictional-passphrase",
                cert.cert.der()
            )
            .is_err()
        );
    }
}

#[test]
fn missing_covers_preserve_the_embedded_tls_identity_for_cache_and_acquisition() {
    let identity = identity();
    let certificate = identity.cert.der().to_vec();
    let config = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(
            vec![identity.cert.der().clone()],
            PrivatePkcs8KeyDer::from(identity.signing_key.serialize_der()).into(),
        )
        .unwrap();
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let address = format!("https://{}", listener.local_addr().unwrap());
    let task = thread::spawn(move || {
        let mut requests = Vec::new();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(12);
        for _ in 0..4 {
            let socket = loop {
                match listener.accept() {
                    Ok((socket, _)) => break socket,
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        assert!(std::time::Instant::now() < deadline);
                        thread::sleep(std::time::Duration::from_millis(5));
                    }
                    Err(error) => panic!("fixture accept failed: {error}"),
                }
            };
            socket.set_nonblocking(false).unwrap();
            socket
                .set_read_timeout(Some(std::time::Duration::from_secs(3)))
                .unwrap();
            socket
                .set_write_timeout(Some(std::time::Duration::from_secs(3)))
                .unwrap();
            let mut stream = rustls::StreamOwned::new(
                rustls::ServerConnection::new(Arc::new(config.clone())).unwrap(),
                socket,
            );
            let mut header = Vec::new();
            while !header.ends_with(b"\r\n\r\n") {
                let mut byte = [0];
                // A failed handshake is evidence, not a fixture-thread panic.
                if stream.read_exact(&mut byte).is_err() {
                    break;
                }
                header.push(byte[0]);
                assert!(header.len() < 4096);
            }
            if !header.ends_with(b"\r\n\r\n") {
                continue;
            }
            let header = String::from_utf8(header).unwrap();
            let first = header.lines().next().unwrap().to_owned();
            let length = header
                .lines()
                .find_map(|line| {
                    line.to_ascii_lowercase()
                        .strip_prefix("content-length:")
                        .map(|value| value.trim().parse::<usize>().unwrap())
                })
                .unwrap_or(0);
            assert!(length < 4096);
            let mut body = vec![0; length];
            stream.read_exact(&mut body).unwrap();
            let (mime, answer) = if first.starts_with("POST /api/auth/v1/session ") {
                assert_eq!(
                    serde_json::from_slice::<serde_json::Value>(&body).unwrap(),
                    serde_json::json!({"username":"fictional","password":"fictional-passphrase"})
                );
                (
                    "application/json",
                    serde_json::json!({"token":"a".repeat(64),"account":{"id":"fictional","role":"admin"}})
                        .to_string()
                        .into_bytes(),
                )
            } else {
                assert!(header.lines().any(|line| {
                    line.eq_ignore_ascii_case(&format!("Authorization: Bearer {}", "a".repeat(64)))
                }));
                assert!(body.is_empty());
                ("image/png", b"\x89PNG\r\n\x1a\n".to_vec())
            };
            requests.push(first);
            write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",answer.len()).unwrap();
            stream.write_all(&answer).unwrap();
            stream.flush().unwrap();
        }
        requests
    });
    let client =
        Client::login_pinned(&address, "fictional", "fictional-passphrase", &certificate).unwrap();
    let artwork = client.artwork("release:fictional", "cover");
    let group = "12345678-1234-1234-1234-123456789abc";
    let cached = client.missing_cover("artist:fictional", group, false);
    let acquired = client.missing_cover("artist:fictional", group, true);
    let requests = task.join().unwrap();
    assert_eq!(artwork.unwrap(), b"\x89PNG\r\n\x1a\n");
    assert_eq!(cached.unwrap(), b"\x89PNG\r\n\x1a\n");
    assert_eq!(acquired.unwrap(), b"\x89PNG\r\n\x1a\n");
    assert_eq!(requests.len(), 4);
    assert!(requests[2].starts_with("GET /api/me/v1/missing/cover?"));
    assert!(requests[3].starts_with("POST /api/me/v1/missing/cover?"));
    for request in &requests[2..] {
        assert!(request.contains("artist=artist%3Afictional"));
        assert!(request.contains(&format!("release_group={group}")));
    }
}
