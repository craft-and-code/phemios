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
