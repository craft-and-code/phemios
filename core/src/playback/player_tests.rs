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
