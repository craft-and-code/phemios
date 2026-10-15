use super::*;
fn state() -> State {
    State {
        status: "playing",
        reference: "track:same".into(),
        index: 0,
        total: 3,
        position: 1234,
        queue_id: 7,
        queue: vec![0, 2, 1],
        tracks: vec![
            "track:same".into(),
            "track:same".into(),
            "track:other".into(),
        ],
        ..State::default()
    }
}
#[test]
fn removing_a_future_occurrence_does_not_touch_audio_clock_or_send_a_command() {
    let player = Player::default();
    let (commands, received) = mpsc::sync_channel(4);
    let (release, wait) = mpsc::channel();
    *player.worker.lock().unwrap() = Some(Worker {
        commands,
        handle: std::thread::spawn(move || {
            wait.recv().unwrap();
        }),
    });
    *player.state.lock().unwrap() = state();
    player.signals.paused.store(false, Ordering::Relaxed);
    player.state.lock().unwrap().protected = vec![0, 1];
    assert!(player.remove(7, 1).is_err());
    player.state.lock().unwrap().protected.clear();
    player.remove(7, 1).unwrap();
    let snapshot = player.snapshot().unwrap();
    assert_eq!(snapshot["queue"], json!([0, 2]));
    assert_eq!(snapshot["index"], 0);
    assert_eq!(snapshot["position_ms"], 1234);
    assert_eq!(snapshot["reference"], "track:same");
    assert!(!player.signals.paused.load(Ordering::Relaxed));
    assert!(received.try_recv().is_err());
    assert!(player.remove(7, 1).is_err());
    assert!(player.remove(6, 2).is_err());
    assert!(
        player
            .control("queue", json!({"queue_id":7,"order":[0,1]}))
            .is_err()
    );
    assert!(
        player
            .control("queue", json!({"queue_id":7,"order":[0,1,2]}))
            .is_err()
    );
    player
        .control("queue", json!({"queue_id":7,"order":[2,0]}))
        .unwrap();
    release.send(()).unwrap();
    player
        .worker
        .lock()
        .unwrap()
        .take()
        .unwrap()
        .handle
        .join()
        .unwrap();
}
#[test]
fn current_removal_advances_in_edited_order_and_preserves_pause() {
    for paused in [false, true] {
        let mut s = state();
        assert!(matches!(
            edit(&mut s, 0, paused).unwrap(),
            Outcome::Advance(2)
        ));
        assert_eq!(s.queue, [2, 1]);
        assert_eq!(s.index, 2);
        assert_eq!(s.reference, "track:other");
        assert_eq!(s.position, 0);
        assert_eq!(s.status, if paused { "paused" } else { "connecting" });
        assert_eq!(s.tracks[0], "");
        assert_eq!(s.tracks[1], "track:same");
    }
}
#[test]
fn removing_current_tail_stops_without_dropping_earlier_occurrences_and_last_item_clears() {
    let mut s = state();
    s.index = 1;
    assert!(matches!(edit(&mut s, 1, false).unwrap(), Outcome::Stop));
    assert_eq!(s.queue, [0, 2]);
    assert_eq!(s.status, "idle");
    assert_eq!(s.reference, "");
    let mut s = State {
        queue: vec![0],
        tracks: vec!["track:one".into()],
        total: 1,
        ..state()
    };
    assert!(matches!(edit(&mut s, 0, false).unwrap(), Outcome::Stop));
    assert_eq!(s.total, 0);
    assert!(s.queue.is_empty());
    assert!(s.tracks.is_empty());
}
#[test]
fn current_remove_waits_for_actor_acknowledgement_before_reporting_success() {
    let player = Player::default();
    *player.state.lock().unwrap() = state();
    let held = player.state.clone();
    let (commands, received) = mpsc::sync_channel(4);
    *player.worker.lock().unwrap() = Some(Worker {
        commands,
        handle: std::thread::spawn(move || {
            if let Command::Remove(index, done) = received.recv().unwrap() {
                edit(&mut held.lock().unwrap(), index, false).unwrap();
                done.send(Ok(())).unwrap();
            } else {
                panic!("expected occurrence removal");
            }
        }),
    });
    player.remove(7, 0).unwrap();
    assert_eq!(player.snapshot().unwrap()["queue"], json!([2, 1]));
    player
        .worker
        .lock()
        .unwrap()
        .take()
        .unwrap()
        .handle
        .join()
        .unwrap();
}

#[test]
fn overlap_reservation_refuses_removed_preloads_before_mixing() {
    let state = Mutex::new(state());
    assert!(reserve_mix(&state, 0, 2).unwrap());
    assert_eq!(state.lock().unwrap().protected, [0, 2]);
    state.lock().unwrap().protected.clear();
    edit(&mut state.lock().unwrap(), 2, false).unwrap();
    assert!(!reserve_mix(&state, 0, 2).unwrap());
    assert!(state.lock().unwrap().protected.is_empty());
}
