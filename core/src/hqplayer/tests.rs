use super::*;
use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
};
#[test]
fn shared_paths_preserve_component_boundaries_and_escape_uri() {
    let mapping = json!([{"from":"/music","to":"/shared"},{"from":"/music/live","to":"/concerts"}]);
    assert_eq!(
        paths::uri("/music/live/a & b.flac", &mapping).unwrap(),
        "file:///concerts/a%20%26%20b.flac"
    );
    assert_eq!(
        paths::uri("/music-other/a.flac", &mapping).unwrap(),
        "file:///music-other/a.flac"
    );
    for path in [
        "../music/a",
        "/music/../a",
        "https://server/a?token=secret",
        "C:\\Music\\a.flac",
    ] {
        assert!(paths::uri(path, &mapping).is_err());
    }
}
#[test]
fn real_tcp_fragmented_protocol_drives_transport_without_resetting_during_probe() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let worker = thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket
            .set_read_timeout(Some(std::time::Duration::from_secs(3)))
            .unwrap();
        let mut names = Vec::new();
        let mut frame = Vec::new();
        let mut state = 2;
        let mut position = 0.;
        let mut volume = -30.;
        let mut random = 0;
        loop {
            let mut byte = [0];
            if socket.read_exact(&mut byte).is_err() {
                break;
            }
            frame.push(byte[0]);
            if !frame.ends_with(b"/>") {
                continue;
            }
            let text = String::from_utf8(std::mem::take(&mut frame)).unwrap();
            let command = text.split("?>").last().unwrap().trim_start_matches('<');
            let name = command.split([' ', '/']).next().unwrap().to_owned();
            names.push(name.clone());
            if name == "Pause" {
                state = 1;
            }
            if name == "Play" {
                state = 2;
            }
            if name == "Seek" {
                position = 42.;
            }
            if name == "Volume" {
                volume = -15.;
            }
            if name == "VolumeMute" {
                volume = -60.;
            }
            if name == "SetRandom" {
                assert!(text.contains("value=\"0\"") || text.contains("value=\"1\""));
                random = u8::from(text.contains("value=\"1\""));
            }
            let reply = match name.as_str() {
                "GetInfo" => {
                    "<GetInfo name=\"Fixture\" product=\"HQPlayer Desktop\" version=\"6.0.1\"/>"
                        .into()
                }
                "VolumeRange" => "<VolumeRange min=\"-60\" max=\"0\" enabled=\"1\"/>".into(),
                "Status" => format!(
                    "<Status state=\"{state}\" track_id=\"opaque-id\" tracks_total=\"1\" position=\"{position}\" length=\"120\" volume=\"{volume}\" random=\"{random}\"><metadata uri=\"file:///music/a.flac\"/></Status>"
                ),
                _ => format!("<{name} result=\"OK\"/>"),
            };
            if name == "Volume" {
                socket.write_all(b"<Status state=\"2\"/>").unwrap();
            }
            for piece in reply.as_bytes().chunks(7) {
                if socket.write_all(piece).is_err() {
                    return names;
                }
            }
        }
        names
    });
    let player = Controller::default();
    assert_eq!(
        player.connect("127.0.0.1", port).unwrap()["connected"],
        true
    );
    assert!(!player.active());
    player
        .start_uris(
            vec!["track:a".into()],
            vec!["file:///music/a.flac".into()],
            0,
            || true,
        )
        .unwrap();
    assert_eq!(player.snapshot().unwrap()["status"], "playing");
    player.control("pause", Value::Null).unwrap();
    assert_eq!(player.snapshot().unwrap()["status"], "paused");
    assert_eq!(player.control("seek", json!(42000)).unwrap()["seek_id"], 1);
    assert_eq!(player.snapshot().unwrap()["seek_id"], 1);
    player.control("volume", json!(0.75)).unwrap();
    assert_eq!(player.snapshot().unwrap()["volume"], 0.75);
    player.control("mute", Value::Null).unwrap();
    assert_eq!(player.snapshot().unwrap()["volume"], 0.);
    player.control("shuffle", json!(true)).unwrap();
    assert_eq!(player.snapshot().unwrap()["shuffled"], true);
    player.disconnect().unwrap();
    assert!(!player.connected());
    let names = worker.join().unwrap();
    assert_eq!(&names[..3], &["GetInfo", "VolumeRange", "Status"]);
    assert!(names.contains(&"PlaylistAdd".into()));
    assert_eq!(names.last().unwrap(), "Stop");
}
#[test]
fn denied_peer_is_never_reported_connected() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let worker = thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        let mut data = [0; 128];
        assert!(socket.read(&mut data).unwrap() > 0);
        socket.write_all(b"<GetInfo result=\"Error\"/>").unwrap();
    });
    let player = Controller::default();
    assert!(player.connect("127.0.0.1", port).is_err());
    assert!(!player.connected());
    worker.join().unwrap();
}

fn authenticated_fixture(
    role: &str,
    detail: Option<Value>,
) -> (crate::network::Client, std::thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let role = role.to_owned();
    let worker = thread::spawn(move || {
        let replies=std::iter::once(json!({"token":"a".repeat(64),"account":{"id":"fixture","username":"fixture","role":role}})).chain(detail);
        for reply in replies {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(std::time::Duration::from_secs(3)))
                .unwrap();
            let mut header = Vec::new();
            let mut byte = [0];
            while !header.ends_with(b"\r\n\r\n") {
                socket.read_exact(&mut byte).unwrap();
                header.push(byte[0]);
                assert!(header.len() < 8192);
            }
            let length = String::from_utf8(header)
                .unwrap()
                .lines()
                .find_map(|line| {
                    line.to_lowercase()
                        .strip_prefix("content-length: ")
                        .and_then(|v| v.parse::<usize>().ok())
                })
                .unwrap_or(0);
            let mut body = vec![0; length];
            socket.read_exact(&mut body).unwrap();
            let body = reply.to_string();
            write!(socket,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
        }
    });
    let client =
        crate::network::Client::login(&format!("http://{address}"), "fixture", "fixture-password")
            .unwrap();
    (client, worker)
}
#[test]
fn role_and_cancellation_refuse_paths_before_playback_and_valid_details_map_exactly() {
    let (client, worker) = authenticated_fixture("auditor", None);
    assert!(client.same_session(&client.clone()));
    let previous = client.clone();
    let result = Controller::prepare(&client, vec!["track:a".into()], 0, &json!([]), || true);
    assert!(result.err().unwrap().contains("compte"));
    worker.join().unwrap();
    let (client, worker) = authenticated_fixture("user", None);
    assert!(!previous.same_session(&client));
    let result = Controller::prepare(&client, vec!["track:a".into()], 0, &json!([]), || false);
    assert!(result.err().unwrap().contains("annulée"));
    worker.join().unwrap();
    let (client, worker) = authenticated_fixture(
        "user",
        Some(json!({"reference":"track:a","path":"/music/quiet sky.flac"})),
    );
    let value = Controller::prepare(
        &client,
        vec!["track:a".into()],
        0,
        &json!([{"from":"/music","to":"/shared"}]),
        || true,
    )
    .unwrap();
    assert_eq!(value.uris, ["file:///shared/quiet%20sky.flac"]);
    assert_eq!(value.tracks, ["track:a"]);
    worker.join().unwrap();
    let (client, worker) = authenticated_fixture(
        "user",
        Some(json!({"reference":"track:b","path":"/music/a.flac"})),
    );
    assert!(
        Controller::prepare(&client, vec!["track:a".into()], 0, &json!([]), || true)
            .err()
            .unwrap()
            .contains("Identité")
    );
    worker.join().unwrap();
}
