use super::*;

fn confirmed_stop(reply: Option<Value>) -> (Result<(), String>, bool) {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let client =
        crate::network::test_support::client(format!("http://{}", listener.local_addr().unwrap()));
    let peer = std::thread::spawn(move || {
        let tcp = listener.accept().unwrap().0;
        tcp.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        let mut socket = tungstenite::accept(tcp).unwrap();
        let request: Value =
            serde_json::from_str(socket.read().unwrap().to_text().unwrap()).unwrap();
        assert_eq!(request, json!({"type":"stop","epoch":3,"frames":1200}));
        if let Some(reply) = reply {
            socket
                .send(Message::Text(reply.to_string().into()))
                .unwrap();
        }
        socket.close(None).unwrap();
    });
    let state = Mutex::new(State::default());
    let result = stop(&mut socket::connect(&client).unwrap(), 3, 1200, &state);
    peer.join().unwrap();
    let confirmed = state.lock().unwrap().confirmed;
    (result, confirmed)
}

#[test]
fn stop_preserves_the_actual_server_failure_without_claiming_saved_history() {
    let (result, confirmed) = confirmed_stop(Some(json!({
        "type":"error",
        "code":"history_failed",
        "message":"history storage remained busy; saving was not confirmed"
    })));
    let error = result.unwrap_err();
    assert!(error.contains("L’historique est occupé"), "{error}");
    assert!(error.contains("L’écoute n’a pas été confirmée"));
    assert!(!confirmed);
}

#[test]
fn stop_accepts_saved_but_a_closed_transport_never_invents_confirmation() {
    let (result, confirmed) = confirmed_stop(Some(json!({"type":"saved"})));
    assert_eq!(result, Ok(()));
    assert!(confirmed);
    let (result, confirmed) = confirmed_stop(None);
    assert!(result.unwrap_err().contains("reste incertain"));
    assert!(!confirmed);
}
