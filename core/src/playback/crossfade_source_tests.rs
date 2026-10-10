use super::*;
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
        assert!(matches!(
            source
                .packets
                .recv_timeout(Duration::from_secs(5))
                .unwrap()
                .unwrap(),
            Packet::Format(_)
        ));
        assert!(matches!(
            source
                .packets
                .recv_timeout(Duration::from_secs(5))
                .unwrap()
                .unwrap(),
            Packet::Samples(_)
        ));
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
