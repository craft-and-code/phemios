use super::*;
use std::{
    io::{Read, Write},
    net::TcpListener,
};
#[test]
fn clearing_owned_hq_selection_stops_once_and_keeps_verified_connection() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let peer = std::thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket
            .set_read_timeout(Some(std::time::Duration::from_secs(3)))
            .unwrap();
        let mut frame = Vec::new();
        while !frame.ends_with(b"/>") {
            let mut byte = [0];
            socket.read_exact(&mut byte).unwrap();
            frame.push(byte[0]);
        }
        assert!(String::from_utf8(frame).unwrap().contains("<Stop"));
        socket.write_all(b"<Stop result=\"OK\"/>").unwrap();
    });
    let controller = Controller::default();
    *controller.session.lock().unwrap() = Some(Session {
        connection: Connection::connect("127.0.0.1", port).unwrap(),
        tracks: vec!["track:one".into()],
        uris: vec!["file:///fixture/a.flac".into()],
        snapshot: json!({"status":"paused"}),
        volume_min: -60.,
        volume_max: 0.,
        volume_enabled: true,
        seek: 7,
        seek_pending: Some((7, 1200)),
        active: true,
    });
    controller.clear().unwrap();
    assert!(controller.connected());
    assert!(!controller.active());
    {
        let held = controller.session.lock().unwrap();
        let session = held.as_ref().unwrap();
        assert!(session.tracks.is_empty());
        assert!(session.uris.is_empty());
        assert!(session.snapshot.is_null());
        assert_eq!(session.seek, 0);
        assert!(session.seek_pending.is_none());
    }
    controller.clear().unwrap();
    peer.join().unwrap();
}
