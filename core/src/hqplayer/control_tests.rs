use super::*;
use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
};

fn owned_endpoint(
    state: u8,
    volume_enabled: bool,
    refuse_volume: bool,
) -> (Controller, thread::JoinHandle<Vec<String>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let worker = thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket
            .set_read_timeout(Some(std::time::Duration::from_secs(3)))
            .unwrap();
        let mut names = Vec::new();
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
            let reply = match name.as_str() {
                "Status" => format!(
                    "<Status state=\"{state}\" tracks_total=\"1\" position=\"120\" length=\"120\" volume=\"-30\"><metadata uri=\"file:///fixture/a.flac\"/></Status>"
                ),
                "Volume" if refuse_volume => "<Volume result=\"Error\"/>".into(),
                "Stop" | "Volume" => format!("<{name} result=\"OK\"/>"),
                _ => panic!("unexpected command {name}"),
            };
            names.push(name);
            socket.write_all(reply.as_bytes()).unwrap();
        }
    });
    let controller = Controller::default();
    *controller.session.lock().unwrap() = Some(Session {
        connection: Connection::connect("127.0.0.1", port).unwrap(),
        tracks: vec!["track:one".into()],
        uris: vec!["file:///fixture/a.flac".into()],
        snapshot: Value::Null,
        volume_min: -60.,
        volume_max: 0.,
        volume_enabled,
        seek: 0,
        seek_pending: None,
        active: true,
    });
    (controller, worker)
}

#[test]
fn natural_completion_keeps_queue_ownership_until_explicit_retirement() {
    let (controller, worker) = owned_endpoint(0, true, false);
    assert_eq!(controller.snapshot().unwrap()["status"], "ended");
    assert!(
        controller.active(),
        "completed HQ queues still own the transport route"
    );
    controller.halt().unwrap();
    assert!(!controller.active());
    drop(controller);
    assert_eq!(worker.join().unwrap(), ["Status", "Stop"]);
}

#[test]
fn disabled_volume_refusal_preserves_owned_transport_and_connection() {
    let (controller, worker) = owned_endpoint(2, false, false);
    let result = controller.control("volume", json!(0.5));
    let active = controller.active();
    let connected = controller.connected();
    let snapshot = controller.snapshot();
    controller.halt().unwrap();
    drop(controller);
    let names = worker.join().unwrap();
    assert_eq!(result, Err("Activez le volume dans HQPlayer.".into()));
    assert!(
        active,
        "a disabled setting must not stop the owned audio: {names:?}"
    );
    assert!(connected);
    assert_eq!(snapshot.unwrap()["status"], "playing");
    assert_eq!(names, ["Status", "Stop"]);
}

#[test]
fn protocol_volume_failure_still_stops_and_retires_the_connection() {
    let (controller, worker) = owned_endpoint(2, true, true);
    assert!(controller.control("volume", json!(0.5)).is_err());
    assert!(!controller.active());
    assert!(!controller.connected());
    drop(controller);
    assert_eq!(worker.join().unwrap(), ["Volume", "Stop"]);
}

#[test]
fn late_local_settings_cannot_stop_the_hqplayer_queue() {
    for (action, value) in [("crossfade", json!(3000)), ("repeat", json!("all"))] {
        rejected_control_keeps_audio(action, value);
    }
}

#[test]
fn rejected_control_values_do_not_retire_a_healthy_connection() {
    for (action, value) in [
        ("volume", json!(1.1)),
        ("volume", Value::Null),
        ("seek", json!(-1)),
        ("seek", json!(604800001u64)),
        ("jump", json!(1)),
        ("jump", Value::Null),
        ("policy", json!("dsp")),
        ("output", json!("local-device")),
        ("unknown", Value::Null),
    ] {
        rejected_control_keeps_audio(action, value);
    }
}

fn rejected_control_keeps_audio(action: &str, value: Value) {
    let (controller, worker) = owned_endpoint(2, true, false);
    let result = controller.control(action, value);
    let active = controller.active();
    let connected = controller.connected();
    let snapshot = controller.snapshot();
    controller.halt().unwrap();
    drop(controller);
    let names = worker.join().unwrap();
    assert!(result.is_err());
    assert!(
        active,
        "locally refused {action} stopped owned playback: {names:?}"
    );
    assert!(connected);
    assert_eq!(snapshot.unwrap()["status"], "playing");
    assert_eq!(names, ["Status", "Stop"]);
}
