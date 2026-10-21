use super::*;
use std::{
    io::{Read, Write},
    net::TcpListener,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    thread,
};

#[test]
fn cancellation_during_playlist_upload_stops_before_the_next_command() {
    cancelled_start("PlaylistAdd", 1, &["Stop", "PlaylistAdd", "Stop"]);
}

#[test]
fn cancellation_after_the_final_upload_never_selects_or_plays() {
    cancelled_start(
        "PlaylistAdd",
        2,
        &["Stop", "PlaylistAdd", "PlaylistAdd", "Stop"],
    );
}

#[test]
fn cancellation_after_selection_never_plays() {
    cancelled_start(
        "SelectTrack",
        1,
        &["Stop", "PlaylistAdd", "PlaylistAdd", "SelectTrack", "Stop"],
    );
}

#[test]
fn cancellation_during_play_stops_without_publishing_an_active_output() {
    cancelled_start(
        "Play",
        1,
        &[
            "Stop",
            "PlaylistAdd",
            "PlaylistAdd",
            "SelectTrack",
            "Play",
            "Stop",
        ],
    );
}

#[test]
fn cancellation_during_initial_stop_prevents_playlist_mutation() {
    cancelled_start("Stop", 1, &["Stop", "Stop"]);
}

#[test]
fn cancellation_before_start_leaves_the_connected_endpoint_untouched() {
    cancelled_start("", 0, &[]);
}

fn cancelled_start(cancel_at: &'static str, occurrence: usize, expected: &[&str]) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let current = Arc::new(AtomicBool::new(!cancel_at.is_empty()));
    let admission = current.clone();
    let worker = thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket
            .set_read_timeout(Some(std::time::Duration::from_secs(3)))
            .unwrap();
        let mut names = Vec::new();
        let mut matches = 0;
        loop {
            let mut frame = Vec::new();
            loop {
                let mut byte = [0];
                if socket.read_exact(&mut byte).is_err() {
                    return names;
                }
                frame.push(byte[0]);
                assert!(frame.len() <= 65536);
                if frame.ends_with(b"/>") {
                    break;
                }
            }
            let xml = String::from_utf8(frame).unwrap();
            let name = xml
                .split("?>")
                .last()
                .unwrap()
                .trim_start_matches('<')
                .split([' ', '/'])
                .next()
                .unwrap()
                .to_owned();
            if name == cancel_at {
                matches += 1;
                if matches == occurrence {
                    current.store(false, Ordering::SeqCst);
                }
            }
            names.push(name.clone());
            write!(socket, "<{name} result=\"OK\"/>").unwrap();
        }
    });
    let controller = Controller::default();
    *controller.session.lock().unwrap() = Some(Session {
        connection: Connection::connect("127.0.0.1", port).unwrap(),
        tracks: Vec::new(),
        uris: Vec::new(),
        snapshot: Value::Null,
        volume_min: -60.,
        volume_max: 0.,
        volume_enabled: true,
        seek: 0,
        seek_pending: None,
        active: false,
    });
    let result = controller.start(
        Selection {
            tracks: vec!["track:one".into(), "track:two".into()],
            uris: vec![
                "file:///fixture/one.flac".into(),
                "file:///fixture/two.flac".into(),
            ],
            index: 0,
        },
        || admission.load(Ordering::SeqCst),
    );
    let active = controller.active();
    let connected = controller.connected();
    drop(controller);
    let names = worker.join().unwrap();
    assert!(
        result.is_err(),
        "cancelled upload must not report an accepted output: {names:?}"
    );
    assert!(!active);
    assert_eq!(connected, cancel_at.is_empty());
    assert_eq!(names, expected);
}
