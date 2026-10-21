use super::*;
use std::cell::Cell;

fn delayed_retirement(action: &str) {
    let routing = Mutex::new(());
    let epoch = AtomicU64::new(0);
    let playing = Cell::new(None);
    // IPC reserves its ticket before scheduling the blocking worker.
    let pending = epoch.fetch_add(1, Ordering::SeqCst) + 1;
    let successor = epoch.fetch_add(1, Ordering::SeqCst) + 1;
    {
        let _guard = routing.lock().expect("routing");
        playing.set(Some(successor));
    }
    // The older worker reaches routing only after the newer source started.
    let result = control(&routing, &epoch, Some(pending), action, || {
        playing.set(None);
        Ok(())
    });
    assert_eq!(
        playing.get(),
        Some(successor),
        "late {action} halted the newer source"
    );
    assert!(result.is_err());
}

#[test]
fn delayed_stop_cannot_halt_a_newer_source() {
    delayed_retirement("stop");
}

#[test]
fn delayed_clear_cannot_erase_a_newer_queue() {
    delayed_retirement("clear");
}

#[test]
fn current_stop_and_clear_still_retire_the_source() {
    for action in ["stop", "clear"] {
        let routing = Mutex::new(());
        let epoch = AtomicU64::new(1);
        let playing = Cell::new(true);
        control(&routing, &epoch, Some(1), action, || {
            assert!(
                routing.try_lock().is_err(),
                "control must retain routing ownership"
            );
            playing.set(false);
            Ok(())
        })
        .expect("current retirement");
        assert!(!playing.get());
    }
}

#[test]
fn ordinary_controls_do_not_require_a_retirement_ticket() {
    let routing = Mutex::new(());
    let epoch = AtomicU64::new(2);
    let gain = Cell::new(0.5);
    control(&routing, &epoch, None, "volume", || {
        gain.set(0.2);
        Ok(())
    })
    .expect("volume");
    assert_eq!(gain.get(), 0.2);
}
