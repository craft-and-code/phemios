use super::*;
#[test]
fn appending_keeps_active_output_clock_order_and_repeated_occurrences() {
    let player = Player::default();
    let (commands, received) = mpsc::sync_channel(4);
    let (release, wait) = mpsc::channel();
    *player.worker.lock().unwrap() = Some(Worker {
        commands,
        handle: std::thread::spawn(move || {
            let _ = wait.recv();
        }),
    });
    {
        let mut s = player.state.lock().unwrap();
        s.status = "playing";
        s.queue_id = 7;
        s.total = 2;
        s.index = 1;
        s.reference = "track:two".into();
        s.position = 4321;
        s.tracks = vec!["track:one".into(), "track:two".into()];
        s.queue = vec![1, 0];
    }
    player.signals.paused.store(false, Ordering::Relaxed);
    let result = player.append(7, 2, vec!["track:three".into(), "track:three".into()]);
    let snapshot = player.snapshot().unwrap();
    let command = received.try_recv();
    let paused = player.signals.paused.load(Ordering::Relaxed);
    let stale = player.append(7, 2, vec!["track:four".into()]);
    let invalid = player.append(7, 4, vec!["not-a-track".into()]);
    let phantom = player.control("queue", json!({"queue_id":7,"order":[0,1,2,3,4]}));
    release.send(()).unwrap();
    player.halt().unwrap();
    assert!(result.is_ok(), "{result:?}");
    assert_eq!(snapshot["queue"], json!([1, 0, 2, 3]));
    assert_eq!(snapshot["total"], 4);
    assert_eq!(snapshot["index"], 1);
    assert_eq!(snapshot["position_ms"], 4321);
    assert_eq!(snapshot["queue_id"], 7);
    assert!(!paused);
    assert!(matches!(command, Err(mpsc::TryRecvError::Empty)));
    assert!(stale.is_err());
    assert!(invalid.is_err());
    assert!(
        phantom.is_err(),
        "reorder must never create unknown occurrences"
    );
}
#[test]
fn growing_queue_synchronization_preserves_cursor_and_next_boundary() {
    let mut queue = queue::Queue::new(2, 1);
    queue.synchronize(&[1, 0], false, 2).unwrap();
    queue.synchronize(&[1, 0, 2, 3], false, 4).unwrap();
    assert_eq!(queue.index(), 1);
    assert!(queue.next());
    assert_eq!(queue.index(), 0);
    assert!(queue.next());
    assert_eq!(queue.index(), 2);
    assert!(queue.synchronize(&[0, 1], false, 4).is_err());
}
