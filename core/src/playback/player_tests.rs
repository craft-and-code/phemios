use super::*;
#[test]
fn transport_validation_and_idle_state_do_not_open_audio_or_expose_credentials() {
    let player = Player::default();
    assert_eq!(player.snapshot().unwrap()["status"], "idle");
    assert!(player.control("volume", json!(-0.1)).is_err());
    assert!(player.control("volume", json!(1.1)).is_err());
    assert!(player.control("seek", json!(86_400_001)).is_err());
    assert!(player.control("seek", json!(-1)).is_err());
    assert!(player.control("shuffle", Value::Null).is_err());
    assert!(player.control("shuffle", Value::Bool(true)).is_err());
    assert!(player.control("resume", Value::Null).is_err());
    player.control("volume", json!(0.25)).unwrap();
    player.halt().unwrap();
    let snapshot = player.snapshot().unwrap();
    assert_eq!(snapshot["volume"], 0.25);
    assert!(snapshot.get("token").is_none());
    assert!(snapshot.get("server").is_none());
}

#[test]
fn snapshot_exposes_meters_only_for_active_unpaused_consumption() {
    let player = Player::default();
    for level in &player.signals.levels {
        level.store(0.5_f32.to_bits(), Ordering::Relaxed);
    }
    player.state.lock().unwrap().status = "playing";
    player.signals.paused.store(false, Ordering::Relaxed);
    assert_eq!(
        player.snapshot().unwrap()["levels"],
        json!([0.5, 0.5, 0.5, 0.5])
    );
    player.signals.paused.store(true, Ordering::Relaxed);
    assert_eq!(
        player.snapshot().unwrap()["levels"],
        json!([0., 0., 0., 0.])
    );
    player.signals.paused.store(false, Ordering::Relaxed);
    for status in ["idle", "paused", "ended", "error", "connecting"] {
        player.state.lock().unwrap().status = status;
        assert_eq!(
            player.snapshot().unwrap()["levels"],
            json!([0., 0., 0., 0.])
        );
    }
}

#[test]
fn seek_tickets_distinguish_accepted_commands_from_applied_positions() {
    let player = Player::default();
    let (tx, rx) = mpsc::sync_channel(4);
    let (keep_tx, keep_rx) = mpsc::channel();
    *player.worker.lock().unwrap() = Some(Worker {
        commands: tx,
        handle: std::thread::spawn(move || {
            let _ = keep_rx.recv();
        }),
    });
    let ticket = player.seek(4500).unwrap();
    assert!(ticket > 0);
    assert_eq!(player.snapshot().unwrap()["seek_id"], 0);
    match rx.recv().unwrap() {
        Command::Seek(position, id) => {
            assert_eq!(position, 4500);
            assert_eq!(id, ticket);
        }
        _ => panic!("expected seek"),
    }
    assert!(player.seek(86_400_001).is_err());
    keep_tx.send(()).unwrap();
    player.halt().unwrap();
}
#[test]
fn enabling_shuffle_does_not_pause_or_send_a_stream_restart_command() {
    let player = Player::default();
    let (commands, receiver) = std::sync::mpsc::sync_channel(32);
    let (release, wait) = std::sync::mpsc::channel();
    let handle = std::thread::spawn(move || {
        let _ = wait.recv();
    });
    *player.worker.lock().unwrap() = Some(Worker { commands, handle });
    {
        let mut state = player.state.lock().unwrap();
        state.status = "playing";
        state.total = 5;
        state.index = 1;
        state.queue = (0..5).collect();
        state.position = 1234;
    }
    player.signals.paused.store(false, Ordering::Relaxed);
    assert!(player.control("jump", serde_json::json!(5)).is_err());
    assert!(!player.signals.paused.load(Ordering::Relaxed));
    player.control("shuffle", serde_json::json!(true)).unwrap();
    assert!(!player.signals.paused.load(Ordering::Relaxed));
    assert!(matches!(
        receiver.try_recv(),
        Err(std::sync::mpsc::TryRecvError::Empty)
    ));
    let state = player.snapshot().unwrap();
    assert_eq!(state["position_ms"], 1234);
    assert_eq!(state["index"], 1);
    assert_eq!(state["shuffled"], true);
    release.send(()).unwrap();
    player.halt().unwrap();
}

#[test]
fn manual_queue_order_preserves_sound_and_rejects_stale_selections() {
    let player = Player::default();
    let (commands, receiver) = mpsc::sync_channel(32);
    let (release, wait) = mpsc::channel();
    *player.worker.lock().unwrap() = Some(Worker {
        commands,
        handle: std::thread::spawn(move || {
            let _ = wait.recv();
        }),
    });
    {
        let mut state = player.state.lock().unwrap();
        state.status = "playing";
        state.total = 4;
        state.index = 1;
        state.reference = "track:current".into();
        state.queue = vec![0, 1, 2, 3];
        state.position = 1234;
    }
    player.signals.paused.store(false, Ordering::Relaxed);
    let id = player.snapshot().unwrap()["queue_id"].clone();
    let result = player.control("queue", json!({"queue_id":id,"order":[3,2,1,0]}));
    // Always release the worker, including when the regression assertion fails.
    let snapshot = player.snapshot().unwrap();
    let paused = player.signals.paused.load(Ordering::Relaxed);
    let command = receiver.try_recv();
    let invalid = player.control("queue", json!({"queue_id":id,"order":[0,0,1,2]}));
    let stale = player.control("queue", json!({"queue_id":999,"order":[0,1,2,3]}));
    release.send(()).unwrap();
    assert!(result.is_ok(), "{result:?}");
    assert_eq!(snapshot["queue"], json!([3, 2, 1, 0]));
    assert_eq!(snapshot["index"], 1);
    assert_eq!(snapshot["position_ms"], 1234);
    assert!(!paused);
    assert!(matches!(command, Err(mpsc::TryRecvError::Empty)));
    assert!(invalid.is_err());
    assert!(stale.is_err());
    assert_eq!(player.snapshot().unwrap()["queue"], json!([3, 2, 1, 0]));
    player.halt().unwrap();
}

#[test]
fn crossfade_and_repeat_are_bounded_idle_controls_without_network_or_audio() {
    let player = Player::default();
    player.control("crossfade", json!(2500)).unwrap();
    player.control("repeat", json!("all")).unwrap();
    assert_eq!(player.snapshot().unwrap()["crossfade_ms"], 2500);
    assert_eq!(player.snapshot().unwrap()["repeat"], "all");
    for value in [json!(-1), json!(10001), json!(1.5), json!("500")] {
        assert!(player.control("crossfade", value).is_err());
    }
    assert!(player.control("repeat", json!("random")).is_err());
    assert_eq!(player.snapshot().unwrap()["status"], "idle");
}

#[test]
fn changing_crossfade_including_zero_preserves_active_and_paused_output() {
    let player = Player::default();
    let (commands, receiver) = mpsc::sync_channel(32);
    let (release, wait) = mpsc::channel();
    *player.worker.lock().unwrap() = Some(Worker {
        commands,
        handle: std::thread::spawn(move || {
            let _ = wait.recv();
        }),
    });
    let mut observations = Vec::new();
    for paused in [false, true] {
        player.signals.paused.store(paused, Ordering::Relaxed);
        {
            let mut state = player.state.lock().unwrap();
            state.status = if paused { "paused" } else { "playing" };
            state.reference = "track:current".into();
            state.position = 1234;
        }
        for ms in [5000, 0, 1000] {
            let result = player.control("crossfade", json!(ms));
            observations.push((
                paused,
                result,
                player.signals.paused.load(Ordering::Relaxed),
                player.snapshot().unwrap(),
                receiver.try_recv(),
                ms,
            ));
        }
    }
    release.send(()).unwrap();
    player.halt().unwrap();
    for (paused, result, actual, state, command, ms) in observations {
        assert!(result.is_ok());
        assert_eq!(actual, paused, "crossfade must never suspend the output");
        assert_eq!(state["status"], if paused { "paused" } else { "playing" });
        assert_eq!(state["position_ms"], 1234);
        assert_eq!(state["reference"], "track:current");
        assert!(matches!(command, Ok(Command::Crossfade(value)) if value == ms));
    }
}

#[test]
fn mode_changes_never_suspend_the_current_audio_or_rewrite_its_position() {
    let player = Player::default();
    let (commands, receiver) = mpsc::sync_channel(32);
    let (release, wait) = mpsc::channel();
    *player.worker.lock().unwrap() = Some(Worker {
        commands,
        handle: std::thread::spawn(move || {
            let _ = wait.recv();
        }),
    });
    let mut observed = Vec::new();
    for paused in [false, true] {
        player.signals.paused.store(paused, Ordering::Relaxed);
        {
            let mut state = player.state.lock().unwrap();
            state.status = if paused { "paused" } else { "playing" };
            state.position = 1234;
        }
        for mode in ["dsp", "without-effects"] {
            let result = player.control("policy", json!(mode));
            observed.push((
                paused,
                result,
                player.signals.paused.load(Ordering::Relaxed),
                player.snapshot().unwrap(),
                receiver.try_recv(),
            ));
        }
    }
    release.send(()).unwrap();
    player.halt().unwrap();
    for (paused, result, actual, snapshot, command) in observed {
        assert!(result.is_ok());
        assert_eq!(actual, paused, "mode selection must not suspend audio");
        assert_eq!(snapshot["position_ms"], 1234);
        assert!(matches!(command, Ok(Command::Policy(_))));
    }
}
