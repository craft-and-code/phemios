//! Fictional loopback clients for exact native-session admission tests.
use crate::network::Client;
use serde_json::{Value, json};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::Duration;

pub(crate) fn clients(accounts: &[(&str, &str)]) -> Vec<Client> {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let server = format!("http://{}", listener.local_addr().unwrap());
    let accounts: Vec<_> = accounts
        .iter()
        .map(|(id, role)| (id.to_string(), role.to_string()))
        .collect();
    let expected = accounts.clone();
    let worker = std::thread::spawn(move || {
        for (index, (id, role)) in expected.into_iter().enumerate() {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut request = Vec::new();
            while !request.ends_with(b"\r\n\r\n") {
                assert!(request.len() < 8192);
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
            assert_eq!(body["username"], id);
            let response = json!({"token":format!("{index:064x}"),"account":{"id":id,"role":role}})
                .to_string();
            write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",response.len(),response).unwrap();
        }
    });
    let clients = accounts
        .iter()
        .map(|(id, _)| Client::login(&server, id, "fictional-password").unwrap())
        .collect();
    worker.join().unwrap();
    clients
}
pub(crate) fn sessions() -> (Client, Client) {
    let clients = clients(&[("fixture", "user"), ("fixture", "user")]);
    (clients[0].clone(), clients[1].clone())
}
