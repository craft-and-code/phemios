use super::*;
#[test]
fn clearing_stops_and_joins_before_forgetting_queue_but_keeps_audio_settings() {
    let player = Arc::new(Player::default());
    let (commands, received) = mpsc::sync_channel(4);
    let (release, wait) = mpsc::channel();
    let (stopping, stopped) = mpsc::channel();
    *player.worker.lock().unwrap() = Some(Worker {
        commands,
        handle: std::thread::spawn(move || {
            assert!(matches!(received.recv().unwrap(), Command::Stop));
            stopping.send(()).unwrap();
            wait.recv().unwrap();
        }),
    });
    {
        let mut s = player.state.lock().unwrap();
        s.status = "playing";
        s.queue_id = 7;
        s.total = 2;
        s.reference = "track:two".into();
        s.index = 1;
        s.position = 4321;
        s.duration = Some(8000);
        s.tracks = vec!["track:one".into(), "track:two".into()];
        s.queue = vec![1, 0];
        s.device = "fixture-output".into();
        s.policy = Policy::Dsp;
        s.repeat = "all";
        s.crossfade_ms = 1200;
    }
    player
        .signals
        .volume
        .store(0.7_f32.to_bits(), Ordering::Relaxed);
    let held = player.clone();
    let clear = std::thread::spawn(move || held.clear());
    stopped
        .recv_timeout(std::time::Duration::from_secs(3))
        .unwrap();
    assert_eq!(player.snapshot().unwrap()["total"], 2);
    release.send(()).unwrap();
    clear.join().unwrap().unwrap();
    let snapshot = player.snapshot().unwrap();
    assert_eq!(snapshot["status"], "idle");
    assert_eq!(snapshot["reference"], "");
    assert_eq!(snapshot["total"], 0);
    assert_eq!(snapshot["queue"], json!([]));
    assert_eq!(snapshot["queue_id"], 0);
    assert_eq!(snapshot["position_ms"], 0);
    assert_eq!(snapshot["duration_ms"], Value::Null);
    assert_eq!(snapshot["device"], "fixture-output");
    assert_eq!(snapshot["policy"], "dsp");
    assert_eq!(snapshot["repeat"], "all");
    assert_eq!(snapshot["crossfade_ms"], 1200);
    assert_eq!(snapshot["volume"], json!(0.7_f32));
    assert!(player.worker.lock().unwrap().is_none());
    assert!(player.state.lock().unwrap().tracks.is_empty());
    player.clear().unwrap();
}
#[test]
fn refused_stop_does_not_erase_the_selection() {
    let player = Player::default();
    let (commands, received) = mpsc::sync_channel(1);
    drop(received);
    let (release, wait) = mpsc::channel();
    *player.worker.lock().unwrap() = Some(Worker {
        commands,
        handle: std::thread::spawn(move || {
            wait.recv().unwrap();
        }),
    });
    {
        let mut s = player.state.lock().unwrap();
        s.status = "paused";
        s.total = 1;
        s.queue = vec![0];
        s.tracks = vec!["track:one".into()];
    }
    assert!(player.clear().is_err());
    assert_eq!(player.snapshot().unwrap()["total"], 1);
    assert_eq!(player.state.lock().unwrap().tracks, ["track:one"]);
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
