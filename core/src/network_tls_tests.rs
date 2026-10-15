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
