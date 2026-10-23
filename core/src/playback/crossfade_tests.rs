use super::*;

#[test]
fn removed_preload_candidate_never_opens_an_empty_stream_reference() {
    let state = Mutex::new(State {
        status: "playing",
        index: 0,
        total: 2,
        queue: vec![0, 1],
        tracks: vec!["track:current".into(), "track:successor".into()],
        ..State::default()
    });
    // Capture the successor, then apply the allowed concurrent non-current edit
    // before the producer opens a source for that captured slot.
    let candidate = state.lock().unwrap().queue[1];
    assert!(matches!(
        super::super::removal::edit(&mut state.lock().unwrap(), candidate, false).unwrap(),
        super::super::removal::Outcome::Keep
    ));
    assert_eq!(preload_reference(&state, candidate).unwrap(), None);
    assert_eq!(preload_reference(&state, usize::MAX).unwrap(), None);
    assert_eq!(
        preload_reference(&state, 0).unwrap(),
        Some("track:current".into())
    );
}

#[test]
fn stored_fade_never_mixes_without_dsp_and_zero_is_gapless() {
    assert_eq!(fade_duration(super::super::Policy::WithoutEffects, 5000), 0);
    assert_eq!(fade_duration(super::super::Policy::Dsp, 0), 0);
    assert_eq!(fade_duration(super::super::Policy::Dsp, 5000), 5000);
}

#[test]
fn a_failed_inaudible_preload_is_retained_until_its_turn() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let client =
        crate::network::test_support::client(format!("http://{}", listener.local_addr().unwrap()));
    let server = std::thread::spawn(move || {
        let tcp = listener.accept().unwrap().0;
        tcp.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        let mut ws = tungstenite::accept(tcp).unwrap();
        let _ = ws.read().unwrap();
        ws.send(tungstenite::Message::Text(
            serde_json::json!({"type":"error", "error":{"message":"next file unavailable"}})
                .to_string()
                .into(),
        ))
        .unwrap();
    });
    let mut next = Voice::open(
        &client,
        "track:unavailable".into(),
        1,
        (48000, super::super::Policy::WithoutEffects),
        0,
    );
    let deadline = Instant::now() + Duration::from_secs(3);
    let result = loop {
        let result = next.poll_preload();
        if result.is_err() || next.failure.is_some() || Instant::now() >= deadline {
            break result;
        }
        std::thread::sleep(Duration::from_millis(2));
    };
    server.join().unwrap();
    assert!(
        result.is_ok(),
        "an inaudible failure must not abort current output: {result:?}"
    );
    assert!(next.failure.is_some());
    assert!(next.start.is_none());
    assert!(
        next.poll().is_err(),
        "failure is still reported when this visit becomes current"
    );
    assert!(
        next.finish().is_ok(),
        "cancelling an inaudible failed visit must not turn Stop into an error"
    );
    assert!(next.retire().unwrap());
    next.start = Some(0);
    assert!(
        next.poll_preload().is_err(),
        "an already scheduled voice must not hide its failure as an inaudible preload"
    );
    assert!(
        next.finish().is_err(),
        "audible visit failures remain errors"
    );
}

#[test]
fn cancelling_a_failed_preload_does_not_depend_on_polling_its_error_first() {
    let mut outcomes = Vec::new();
    for retiring in [false, true] {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let client = crate::network::test_support::client(format!(
            "http://{}",
            listener.local_addr().unwrap()
        ));
        let server = std::thread::spawn(move || {
            let tcp = listener.accept().unwrap().0;
            tcp.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
            let mut ws = tungstenite::accept(tcp).unwrap();
            let _ = ws.read().unwrap();
            ws.send(tungstenite::Message::Text(
                serde_json::json!({"type":"error","message":"future track refused"})
                    .to_string()
                    .into(),
            ))
            .unwrap();
        });
        let mut next = Voice::open(
            &client,
            "track:future".into(),
            1,
            (48000, super::super::Policy::WithoutEffects),
            0,
        );
        server.join().unwrap();
        assert!(next.start.is_none());
        assert_eq!(next.supplied, 0);
        assert!(
            next.failure.is_none(),
            "the mixer has not polled the pending failure"
        );
        let result = if retiring {
            let deadline = Instant::now() + Duration::from_secs(3);
            loop {
                match next.retire() {
                    Ok(true) => break Ok(()),
                    Ok(false) if Instant::now() < deadline => {
                        std::thread::sleep(Duration::from_millis(2))
                    }
                    Ok(false) => break Err("retirement did not finish".to_owned()),
                    Err(error) => break Err(error),
                }
            }
        } else {
            next.finish()
        };
        outcomes.push((retiring, result));
    }
    assert!(
        outcomes.iter().all(|(_, result)| result.is_ok()),
        "unplayed cleanup must not depend on the producer polling first: {outcomes:?}"
    );
}
