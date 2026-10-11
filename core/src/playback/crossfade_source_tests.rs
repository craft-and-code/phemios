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
                assert_eq!(start["normalize"], "album");
                let reference = start["track"].as_str().unwrap().to_owned();
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
    let mut outgoing = Source::open(&client, "track:outgoing".into(), 48000, 0);
    let mut incoming = Source::open(&client, "track:incoming".into(), 48000, 0);
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
    outgoing.finish().unwrap();
    incoming.finish().unwrap();
    assert!(outgoing.clock.confirmed.load(Ordering::Relaxed));
    assert!(incoming.clock.confirmed.load(Ordering::Relaxed));
    server.join().unwrap();
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
    let mut source = Source::open(&client, "track:one".into(), 48000, 0);
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
