use super::*;
use std::cell::Cell;

#[test]
fn delayed_shutdown_cannot_stop_a_reconnected_engine() {
    let lifecycle = Lifecycle::default();
    let engine = Mutex::new(Some("original"));
    let (stopping, ()) = lifecycle.begin(|| Ok(())).expect("stop reservation");
    let (starting, ()) = lifecycle.begin(|| Ok(())).expect("restart reservation");
    lifecycle
        .with_resource(&engine, starting, |engine| {
            *engine = Some("replacement");
            Ok(())
        })
        .expect("restart");
    let stopped = lifecycle
        .with_resource(&engine, stopping, |engine| {
            *engine = None;
            Ok(())
        })
        .expect("retired stop");
    assert_eq!(*engine.lock().expect("engine"), Some("replacement"));
    assert_eq!(stopped, None);
}

#[test]
fn delayed_start_cannot_reopen_an_engine_after_shutdown() {
    let lifecycle = Lifecycle::default();
    let engine = Mutex::new(None);
    let (starting, ()) = lifecycle.begin(|| Ok(())).expect("start reservation");
    let (stopping, ()) = lifecycle.begin(|| Ok(())).expect("stop reservation");
    lifecycle
        .with_resource(&engine, stopping, |engine| {
            *engine = None;
            Ok(())
        })
        .expect("stop");
    let started = lifecycle
        .with_resource(&engine, starting, |engine| {
            *engine = Some("obsolete");
            Ok(())
        })
        .expect("retired start");
    assert_eq!(*engine.lock().expect("engine"), None);
    assert_eq!(started, None);
}

#[test]
fn new_start_during_startup_retires_the_older_session_publication() {
    let lifecycle = Lifecycle::default();
    let engine = Mutex::new(());
    let published = Cell::new(false);
    let (starting, ()) = lifecycle.begin(|| Ok(())).expect("start reservation");
    let result = lifecycle.with_resource(&engine, starting, |_| {
        // A newer restart may reserve the same account generation during startup IO.
        lifecycle.begin(|| Ok(())).expect("new start reservation");
        lifecycle.publish(starting, || {
            published.set(true);
            Ok(())
        })
    });
    assert!(
        !published.get(),
        "obsolete startup published a live session"
    );
    assert!(result.is_err());
}

#[test]
fn current_work_releases_admission_during_resource_io() {
    let lifecycle = Lifecycle::default();
    let engine = Mutex::new(0);
    let (starting, captured) = lifecycle.begin(|| Ok(7)).expect("capture");
    assert_eq!(captured, 7);
    let result = lifecycle
        .with_resource(&engine, starting, |engine| {
            assert!(
                lifecycle.0.try_lock().is_ok(),
                "IO cannot block cancellation"
            );
            *engine = 1;
            lifecycle.publish(starting, || Ok("published"))
        })
        .expect("current work");
    assert_eq!(result, Some("published"));
    assert_eq!(*engine.lock().expect("engine"), 1);
}

#[test]
fn reconnected_account_and_engine_survive_the_old_shutdown_together() {
    use std::sync::atomic::{AtomicU64, Ordering};
    let (old, replacement) = crate::account_test_support::sessions();
    let owner = Mutex::new(Some(old));
    let generation = AtomicU64::new(1);
    let engine = Mutex::new(Some("original process"));
    let lifecycle = Lifecycle::default();
    let (stopping, ()) = lifecycle
        .begin(|| crate::sessions::invalidate(&owner, &generation).map(|_| ()))
        .expect("invalidate old account");
    let (starting, captured) = lifecycle
        .begin(|| Ok(generation.load(Ordering::SeqCst)))
        .expect("capture replacement account");
    let login = lifecycle
        .with_resource(&engine, starting, |engine| {
            *engine = Some("replacement process");
            lifecycle.publish(starting, || {
                crate::sessions::publish_login(
                    &owner,
                    &generation,
                    captured,
                    replacement.clone(),
                    true,
                )
            })
        })
        .expect("replacement login")
        .expect("current startup");
    let retired = lifecycle
        .with_resource(&engine, stopping, |engine| {
            *engine = None;
            Ok(())
        })
        .expect("retired shutdown");
    assert_eq!(retired, None);
    assert_eq!(*engine.lock().expect("engine"), Some("replacement process"));
    assert!(
        owner
            .lock()
            .expect("account")
            .as_ref()
            .is_some_and(|held| held.same_session(&replacement))
    );
    assert_eq!(
        login["nativeSession"],
        generation.load(Ordering::SeqCst).to_string()
    );
}

#[test]
fn current_shutdown_preserves_independent_audio_and_engine_errors() {
    let lifecycle = Lifecycle::default();
    let routing = Mutex::new(());
    let engine = Mutex::new(true);
    let (ticket, ()) = lifecycle.begin(|| Ok(())).expect("stop");
    let result = phemios_core::session_cleanup::complete(
        || {
            lifecycle
                .with_resource(&routing, ticket, |_| Err::<(), _>("audio failure".into()))
                .map(|_| ())
        },
        || {
            lifecycle
                .with_resource(&engine, ticket, |running| {
                    *running = false;
                    Err::<(), _>("configuration failure".into())
                })
                .map(|_| ())
        },
    );
    assert_eq!(result, Err("audio failure\nconfiguration failure".into()));
    assert!(!*engine.lock().expect("engine"));
}
