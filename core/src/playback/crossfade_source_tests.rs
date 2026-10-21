use super::*;
use std::time::Duration;
#[test]
// Tungstenite fixes this callback error type; no production error is enlarged.
#[allow(clippy::result_large_err)]
fn prebuffering_is_not_acknowledged_and_pause_confirms_only_each_rendered_voice() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let client =
        crate::network::test_support::client(format!("http://{}", listener.local_addr().unwrap()));
    let (reported, received) = mpsc::channel();
    let server = std::thread::spawn(move || {
        let mut workers = Vec::new();
        for _ in 0..2 {
            let tcp = listener.accept().unwrap().0;
            tcp.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
            let reported = reported.clone();
            workers.push(std::thread::spawn(move || {
                let mut ws = tungstenite::accept_hdr(tcp, |request: &tungstenite::handshake::server::Request, response| {
                    assert_eq!(request.headers()["authorization"], "Bearer fictional");
                    assert_eq!(request.uri().path(), "/api/me/v1/playback");
                    Ok(response)
                }).unwrap();
                let start: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
                let reference = start["track"].as_str().unwrap().to_owned();
                assert_eq!(start["normalize"], if reference == "track:outgoing" { "off" } else { "album" });
                ws.send(Message::Text(json!({"type":"format","encoding":"f32le","track":reference,"sample_rate":48000,"channels":2,"epoch":0,"position_ms":0,"duration_ms":1000}).to_string())).unwrap();
                ws.send(Message::Binary(vec![0; 100 * 8])).unwrap();
                loop {
                    let message: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
                    if message["type"] == "ack" {
                        assert!(message["frames"].as_u64().unwrap() > 0);
                        reported.send((reference.clone(), message["frames"].as_u64().unwrap())).unwrap();
                    } else if message["type"] == "stop" {
                        reported.send((reference, message["frames"].as_u64().unwrap())).unwrap();
                        ws.send(Message::Text(json!({"type":"saved"}).to_string())).unwrap();
                        ws.close(None).unwrap();
                        break;
                    } else { panic!("unexpected frame"); }
                }
            }));
        }
        for worker in workers {
            worker.join().unwrap();
        }
    });
    let mut outgoing = Source::open(
        &client,
        "track:outgoing".into(),
        48000,
        0,
        Policy::WithoutEffects,
    );
    let mut incoming = Source::open(&client, "track:incoming".into(), 48000, 0, Policy::Dsp);
    for source in [&outgoing, &incoming] {
        assert!(matches!(next_packet(source).unwrap(), Packet::Format(_)));
        assert!(matches!(next_packet(source).unwrap(), Packet::Samples(_)));
    }
    assert!(received.try_recv().is_err());
    outgoing.clock.consumed.store(80, Ordering::Relaxed);
    incoming.clock.consumed.store(20, Ordering::Relaxed);
    let first = received.recv_timeout(Duration::from_secs(5)).unwrap();
    let second = received.recv_timeout(Duration::from_secs(5)).unwrap();
    let values: std::collections::BTreeMap<_, _> = [first, second].into_iter().collect();
    assert_eq!(values["track:outgoing"], 80);
    assert_eq!(values["track:incoming"], 20);
    // The final stop must include PCM consumed since the preceding timed ACK.
    outgoing.clock.consumed.store(95, Ordering::Relaxed);
    incoming.clock.consumed.store(35, Ordering::Relaxed);
    outgoing.finish().unwrap();
    incoming.finish().unwrap();
    assert!(outgoing.clock.confirmed.load(Ordering::Relaxed));
    assert!(incoming.clock.confirmed.load(Ordering::Relaxed));
    server.join().unwrap();
    let final_values: std::collections::BTreeMap<_, _> = received.into_iter().collect();
    assert_eq!(final_values["track:outgoing"], 95);
    assert_eq!(final_values["track:incoming"], 35);
}

#[test]
fn seeks_reuse_one_authenticated_visit_and_discard_prebuffered_old_audio() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let client =
        crate::network::test_support::client(format!("http://{}", listener.local_addr().unwrap()));
    let server = std::thread::spawn(move || {
        let tcp = listener.accept().unwrap().0;
        tcp.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        let mut ws = tungstenite::accept(tcp).unwrap();
        let start: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
        assert_eq!(start["type"], "start");
        for epoch in 0..=2 {
            ws.send(Message::Text(json!({"type":"format","encoding":"f32le","track":"track:one","sample_rate":48000,"channels":2,"epoch":epoch,"position_ms":if epoch==0 {0} else if epoch==1 {500} else {200},"duration_ms":1000}).to_string())).unwrap();
            ws.send(Message::Binary(vec![0; 100 * 8])).unwrap();
            loop {
                let command: Value =
                    serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
                if command["type"] == "ack" {
                    continue;
                }
                if epoch < 2 {
                    assert_eq!(command["type"], "seek");
                    assert_eq!(command["epoch"], epoch);
                    assert_eq!(command["frames"], if epoch == 0 { 40 } else { 25 });
                    assert_eq!(command["position_ms"], if epoch == 0 { 500 } else { 200 });
                    ws.send(Message::Text(json!({"type":"reset","epoch":epoch+1,"position_ms":command["position_ms"]}).to_string())).unwrap();
                    let ack: Value =
                        serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
                    assert_eq!(ack["type"], "reset_ack");
                    assert_eq!(ack["epoch"], epoch + 1);
                    break;
                }
                assert_eq!(command["type"], "stop");
                assert_eq!(command["epoch"], 2);
                assert_eq!(command["frames"], 10);
                ws.send(Message::Text(json!({"type":"saved"}).to_string()))
                    .unwrap();
                ws.close(None).unwrap();
                return;
            }
        }
    });
    let mut source = Source::open(&client, "track:one".into(), 48000, 0, Policy::Dsp);
    for (position, consumed) in [(500, 40), (200, 25)] {
        let packet = next_packet(&source).unwrap();
        assert!(matches!(packet, Packet::Format(_)));
        // Leave old prefetched PCM queued: it must not appear after the next format.
        source.seek(position, consumed).unwrap();
        assert!(!source.clock.confirmed.load(Ordering::Relaxed));
    }
    let packet = next_packet(&source).unwrap();
    assert!(matches!(packet,Packet::Format(format) if format.position==200));
    assert!(matches!(next_packet(&source).unwrap(), Packet::Samples(_)));
    source.clock.consumed.store(10, Ordering::Relaxed);
    source.finish().unwrap();
    assert!(source.clock.confirmed.load(Ordering::Relaxed));
    server.join().unwrap();
}

fn next_packet(source: &Source) -> Result<Packet, String> {
    let end = Instant::now() + Duration::from_secs(5);
    loop {
        match source.try_recv() {
            Ok(packet) => return packet,
            Err(mpsc::TryRecvError::Empty) if Instant::now() < end => {
                std::thread::sleep(Duration::from_millis(2))
            }
            Err(error) => panic!("Missing source packet: {error}"),
        }
    }
}

#[test]
fn delayed_retired_confirmation_does_not_block_the_active_producer() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let client =
        crate::network::test_support::client(format!("http://{}", listener.local_addr().unwrap()));
    let (stopping, stopped) = mpsc::channel();
    let (release, saving) = mpsc::channel();
    let server = std::thread::spawn(move || {
        let tcp = listener.accept().unwrap().0;
        tcp.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        let mut ws = tungstenite::accept(tcp).unwrap();
        let _: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
        ws.send(Message::Text(json!({"type":"format","encoding":"f32le","track":"track:retired","sample_rate":48000,"channels":2,"epoch":0,"position_ms":0,"duration_ms":1000}).to_string())).unwrap();
        ws.send(Message::Binary(vec![0; 100 * 8])).unwrap();
        loop {
            let command: Value =
                serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
            if command["type"] == "stop" {
                assert_eq!(command["frames"], 100);
                stopping.send(()).unwrap();
                saving.recv_timeout(Duration::from_secs(5)).unwrap();
                ws.send(Message::Text(json!({"type":"saved"}).to_string()))
                    .unwrap();
                ws.close(None).unwrap();
                return;
            }
            assert_eq!(command["type"], "ack");
        }
    });
    let mut source = Source::open(&client, "track:retired".into(), 48000, 0, Policy::Dsp);
    assert!(matches!(next_packet(&source).unwrap(), Packet::Format(_)));
    assert!(matches!(next_packet(&source).unwrap(), Packet::Samples(_)));
    source.clock.consumed.store(100, Ordering::Relaxed);
    let (advanced, advance) = mpsc::channel();
    let producer = std::thread::spawn(move || {
        let worker = source.handle.as_ref().unwrap().thread().id();
        for _ in 0..100 {
            assert!(!source.retire().unwrap());
            assert_eq!(source.handle.as_ref().unwrap().thread().id(), worker);
        }
        let (mut tx, mut rx) = aede_audio::ring::RingBuffer::new(256);
        for _ in 0..256 {
            tx.push([0.25_f32, -0.25]).unwrap();
        }
        let frames = std::iter::from_fn(|| rx.pop().ok()).count();
        advanced.send(frames).unwrap();
        source
    });
    stopped.recv_timeout(Duration::from_secs(5)).unwrap();
    let before_save = advance.recv_timeout(Duration::from_millis(100));
    release.send(()).unwrap();
    let mut source = producer.join().unwrap();
    source.finish().unwrap();
    server.join().unwrap();
    assert_eq!(
        before_save.unwrap(),
        256,
        "the active ring must keep progressing before retired history is confirmed"
    );
    assert!(source.clock.confirmed.load(Ordering::Relaxed));
}

#[test]
fn retired_history_failures_remain_errors_without_claiming_confirmation() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let client =
        crate::network::test_support::client(format!("http://{}", listener.local_addr().unwrap()));
    let server = std::thread::spawn(move || {
        let tcp = listener.accept().unwrap().0;
        tcp.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        let mut ws = tungstenite::accept(tcp).unwrap();
        let _: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
        ws.send(Message::Text(json!({"type":"format","encoding":"f32le","track":"track:retired","sample_rate":48000,"channels":2,"epoch":0,"position_ms":0,"duration_ms":1000}).to_string())).unwrap();
        let stop: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
        assert_eq!(stop["type"], "stop");
        ws.send(Message::Text(json!({"type":"error","message":"history storage remained busy; saving was not confirmed"}).to_string())).unwrap();
    });
    let mut source = Source::open(&client, "track:retired".into(), 48000, 0, Policy::Dsp);
    assert!(matches!(next_packet(&source).unwrap(), Packet::Format(_)));
    let deadline = Instant::now() + Duration::from_secs(5);
    let error = loop {
        match source.retire() {
            Ok(false) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(2)),
            Err(error) => break error,
            value => panic!("retirement must preserve the worker failure: {value:?}"),
        }
    };
    assert!(error.contains("L’historique est occupé"));
    assert!(!source.clock.confirmed.load(Ordering::Relaxed));
    assert!(source.handle.is_none());
    server.join().unwrap();
    assert_eq!(source.retire(), Err(error.clone()));
    assert_eq!(source.finish(), Err(error));
    assert!(!source.clock.confirmed.load(Ordering::Relaxed));
}

#[test]
fn initial_seek_without_reset_cannot_hold_source_cleanup_indefinitely() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let client =
        crate::network::test_support::client(format!("http://{}", listener.local_addr().unwrap()));
    let (seeking, sought) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let server = std::thread::spawn(move || {
        let tcp = listener.accept().unwrap().0;
        tcp.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        let mut ws = tungstenite::accept(tcp).unwrap();
        let start: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
        assert_eq!(start["type"], "start");
        ws.send(Message::Text(json!({"type":"format","encoding":"f32le","track":"track:offset","sample_rate":48000,"channels":2,"epoch":0,"position_ms":0,"duration_ms":1000}).to_string())).unwrap();
        let seek: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
        assert_eq!(seek["type"], "seek");
        assert_eq!(seek["position_ms"], 500);
        seeking.send(()).unwrap();
        // Keep the connection open without acknowledging reset. Release is a
        // test watchdog, not the production cancellation mechanism.
        released.recv_timeout(Duration::from_secs(20)).unwrap();
    });
    let mut source = Source::open(&client, "track:offset".into(), 48000, 500, Policy::Dsp);
    sought.recv_timeout(Duration::from_secs(5)).unwrap();
    source.clock.stop.store(true, Ordering::Release);
    let deadline = Instant::now() + Duration::from_secs(13);
    while !source.handle.as_ref().unwrap().is_finished() && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(10));
    }
    let finished_before_release = source.handle.as_ref().unwrap().is_finished();
    release.send(()).unwrap();
    let failure = source.finish().unwrap_err();
    server.join().unwrap();
    assert!(
        finished_before_release,
        "cleanup depended on the unresponsive peer closing its connection"
    );
    assert!(failure.contains("Confirmation"), "{failure}");
    assert!(!source.clock.confirmed.load(Ordering::Relaxed));
}

#[test]
fn delayed_start_format_cannot_cancel_an_already_requested_stop_deadline() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let client =
        crate::network::test_support::client(format!("http://{}", listener.local_addr().unwrap()));
    let (stopping, stopped) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let server = std::thread::spawn(move || {
        let tcp = listener.accept().unwrap().0;
        tcp.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        let mut ws = tungstenite::accept(tcp).unwrap();
        let start: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
        assert_eq!(start["type"], "start");
        let stop: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
        assert_eq!(stop["type"], "stop");
        ws.send(Message::Text(json!({"type":"format","encoding":"f32le","track":"track:late","sample_rate":48000,"channels":2,"epoch":0,"position_ms":0,"duration_ms":1000}).to_string())).unwrap();
        stopping.send(()).unwrap();
        released.recv_timeout(Duration::from_secs(20)).unwrap();
    });
    let mut source = Source::open(&client, "track:late".into(), 48000, 0, Policy::Dsp);
    source.clock.stop.store(true, Ordering::Release);
    stopped.recv_timeout(Duration::from_secs(5)).unwrap();
    let deadline = Instant::now() + Duration::from_secs(13);
    while !source.handle.as_ref().unwrap().is_finished() && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(10));
    }
    let finished_before_release = source.handle.as_ref().unwrap().is_finished();
    release.send(()).unwrap();
    let failure = source.finish().unwrap_err();
    server.join().unwrap();
    assert!(
        finished_before_release,
        "the late format removed the stop timeout"
    );
    assert!(failure.contains("Confirmation"), "{failure}");
    assert!(!source.clock.confirmed.load(Ordering::Relaxed));
}

#[test]
fn queued_audio_tail_after_stop_does_not_override_saved_history() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let client =
        crate::network::test_support::client(format!("http://{}", listener.local_addr().unwrap()));
    let peer = std::thread::spawn(move || {
        let tcp = listener.accept().unwrap().0;
        tcp.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        let mut ws = tungstenite::accept(tcp).unwrap();
        let start: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
        assert_eq!(start["type"], "start");
        let stop: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
        assert_eq!(stop, json!({"type":"stop","epoch":0,"frames":0}));
        // These were already scheduled by the producer when Stop crossed it.
        ws.send(Message::Text(json!({"type":"format","encoding":"f32le","track":"track:tail","sample_rate":48000,"channels":2,"epoch":0,"position_ms":0,"duration_ms":1000}).to_string())).unwrap();
        ws.send(Message::Binary(vec![0; 16])).unwrap();
        ws.send(Message::Text(
            json!({"type":"eof","epoch":0,"frames":2}).to_string(),
        ))
        .unwrap();
        ws.send(Message::Text(json!({"type":"saved"}).to_string()))
            .unwrap();
        ws.close(None).unwrap();
    });
    let mut source = Source::open(&client, "track:tail".into(), 48000, 0, Policy::Dsp);
    source.clock.stop.store(true, Ordering::Release);
    let result = source.finish();
    peer.join().unwrap();
    assert_eq!(result, Ok(()));
    assert!(source.clock.confirmed.load(Ordering::Relaxed));
    assert!(matches!(
        source.try_recv(),
        Err(mpsc::TryRecvError::Disconnected)
    ));
}

#[test]
fn ignored_tail_after_stop_never_hides_a_real_history_failure() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let client =
        crate::network::test_support::client(format!("http://{}", listener.local_addr().unwrap()));
    let peer = std::thread::spawn(move || {
        let tcp = listener.accept().unwrap().0;
        tcp.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        let mut ws = tungstenite::accept(tcp).unwrap();
        let start: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
        assert_eq!(start["type"], "start");
        let stop: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
        assert_eq!(stop["type"], "stop");
        ws.send(Message::Binary(vec![0; 16])).unwrap();
        ws.send(Message::Text(
            json!({"type":"eof","epoch":0,"frames":2}).to_string(),
        ))
        .unwrap();
        ws.send(Message::Text(json!({"type":"error","message":"history storage remained busy; saving was not confirmed"}).to_string())).unwrap();
    });
    let mut source = Source::open(&client, "track:tail-error".into(), 48000, 0, Policy::Dsp);
    source.clock.stop.store(true, Ordering::Release);
    let failure = source.finish().unwrap_err();
    peer.join().unwrap();
    assert!(failure.contains("L’historique est occupé"), "{failure}");
    assert!(!source.clock.confirmed.load(Ordering::Relaxed));
    assert_eq!(source.finish(), Err(failure));
}
