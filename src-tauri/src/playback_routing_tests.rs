use super::*;
use std::cell::Cell;

fn delayed_retirement(action: &str) {
    let routing = Mutex::new(());
    let epoch = AtomicU64::new(0);
    let published = AtomicU64::new(0);
    let playing = Cell::new(None);
    // IPC reserves its ticket before scheduling the blocking worker.
    let pending = epoch.fetch_add(1, Ordering::SeqCst) + 1;
    let successor = epoch.fetch_add(1, Ordering::SeqCst) + 1;
    {
        let _guard = routing.lock().expect("routing");
        publish(&published, successor, || {
            playing.set(Some(successor));
            Ok(())
        })
        .expect("replacement start");
    }
    // The older worker reaches routing only after the newer source started.
    let result = control(&routing, &published, Some(pending), action, || {
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

#[test]
fn delayed_logout_preserves_replacement_audio_and_releases_only_the_old_client() {
    let (old, replacement) = crate::account_test_support::sessions();
    let owner = Mutex::new(Some(old.clone()));
    let identity = AtomicU64::new(1);
    let routing = Mutex::new(());
    let published = AtomicU64::new(1);
    let playing = Cell::new(Some("original"));
    let retiring = 2;
    let retired = crate::sessions::invalidate(&owner, &identity).expect("logout admission");
    crate::sessions::publish_login(&owner, &identity, 2, replacement.clone(), false)
        .expect("replacement login");
    {
        let _guard = routing.lock().expect("routing");
        publish(&published, 3, || {
            playing.set(Some("replacement"));
            Ok(())
        })
        .expect("replacement output");
    }
    let releases = Cell::new(0);
    phemios_core::session_cleanup::complete(
        || {
            retire(&routing, &published, retiring, || {
                playing.set(None);
                Ok(())
            })
        },
        || {
            let client = retired.as_ref().expect("captured retiring client");
            assert!(client.same_session(&old));
            assert!(!client.same_session(&replacement));
            releases.set(releases.get() + 1);
            Ok(())
        },
    )
    .expect("retired logout cleanup");
    assert_eq!(playing.get(), Some("replacement"));
    assert_eq!(releases.get(), 1);
    assert!(
        owner
            .lock()
            .expect("owner")
            .as_ref()
            .is_some_and(|client| client.same_session(&replacement))
    );
}

#[test]
fn refused_successor_does_not_prevent_logout_from_stopping_old_audio() {
    let routing = Mutex::new(());
    let published = AtomicU64::new(1);
    let playing = Cell::new(true);
    {
        let _guard = routing.lock().expect("routing");
        let result = publish(&published, 3, || Err::<(), _>("replacement refused".into()));
        assert!(result.is_err());
    }
    retire(&routing, &published, 2, || {
        playing.set(false);
        Ok(())
    })
    .expect("logout cleanup");
    assert!(!playing.get());
    assert_eq!(published.load(Ordering::SeqCst), 1);
}

#[test]
fn pending_preparation_does_not_prevent_logout_cleanup() {
    let routing = Mutex::new(());
    let published = AtomicU64::new(1);
    let requests = AtomicU64::new(1);
    let logout = requests.fetch_add(1, Ordering::SeqCst) + 1;
    let pending = requests.fetch_add(1, Ordering::SeqCst) + 1;
    let halted = Cell::new(false);
    retire(&routing, &published, logout, || {
        assert!(routing.try_lock().is_err());
        halted.set(true);
        Ok(())
    })
    .expect("old audio cleanup");
    assert!(halted.get());
    assert!(pending > logout);
}

#[test]
fn failed_audio_cleanup_still_releases_credentials_and_preserves_both_errors() {
    let routing = Mutex::new(());
    let published = AtomicU64::new(1);
    let released = Cell::new(false);
    let result = phemios_core::session_cleanup::complete(
        || retire(&routing, &published, 2, || Err("audio failure".into())),
        || {
            released.set(true);
            Err("revocation failure".into())
        },
    );
    assert!(released.get());
    assert_eq!(result, Err("audio failure\nrevocation failure".into()));
}

#[test]
fn reconnected_local_engine_does_not_keep_revoked_audio_playing() {
    let lifecycle = crate::local_lifecycle::Lifecycle::default();
    let requests = AtomicU64::new(1);
    let published = AtomicU64::new(1);
    let routing = Mutex::new(());
    let engine = Mutex::new(true);
    let playing = Cell::new(true);
    let (stopping, audio_stop) = lifecycle
        .begin(|| Ok(requests.fetch_add(1, Ordering::SeqCst) + 1))
        .expect("local logout");
    let (starting, ()) = lifecycle.begin(|| Ok(())).expect("local restart");
    lifecycle
        .publish(starting, || Ok(()))
        .expect("replacement engine account");
    // Reconnecting the engine is not a replacement audio start.
    phemios_core::session_cleanup::complete(
        || {
            retire(&routing, &published, audio_stop, || {
                playing.set(false);
                Ok(())
            })
        },
        || {
            lifecycle
                .with_resource(&engine, stopping, |running| {
                    *running = false;
                    Ok(())
                })
                .map(|_| ())
        },
    )
    .expect("old cleanup");
    assert!(
        !playing.get(),
        "old account audio survived logout without a replacement start"
    );
    assert!(*engine.lock().expect("replacement engine"));
    assert!(published.load(Ordering::SeqCst) < audio_stop);
}

#[test]
fn unaccepted_replacement_does_not_cancel_stop_or_clear() {
    for action in ["stop", "clear"] {
        for refused in [false, true] {
            let routing = Mutex::new(());
            let requests = AtomicU64::new(1);
            let published = AtomicU64::new(1);
            let playing = Cell::new(true);
            let queue = Cell::new(2);
            let stopping = requests.fetch_add(1, Ordering::SeqCst) + 1;
            let preparing = requests.fetch_add(1, Ordering::SeqCst) + 1;
            if refused {
                let preparation = publish(&published, preparing, || {
                    Err::<(), _>("replacement preparation failed".into())
                });
                assert!(preparation.is_err());
            }
            let result = control(&routing, &published, Some(stopping), action, || {
                playing.set(false);
                if action == "clear" {
                    queue.set(0);
                }
                Ok(())
            });
            assert!(
                !playing.get(),
                "{action} left old audio playing; replacement refused={refused}"
            );
            assert!(result.is_ok());
            assert_eq!(queue.get(), if action == "clear" { 0 } else { 2 });
            assert_eq!(published.load(Ordering::SeqCst), 1);
            if !refused {
                // Cleaning old audio must not cancel the legitimate preparation that came later.
                assert_eq!(requests.load(Ordering::SeqCst), preparing);
                let _guard = routing.lock().expect("routing");
                publish(&published, preparing, || {
                    playing.set(true);
                    queue.set(3);
                    Ok(())
                })
                .expect("later prepared start");
                assert!(playing.get());
                assert_eq!(queue.get(), 3);
            }
        }
    }
}
