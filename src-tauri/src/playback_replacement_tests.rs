use super::*;
use std::cell::Cell;

#[test]
fn cancellation_while_retiring_output_prevents_the_replacement_from_starting() {
    let requests = AtomicU64::new(2);
    let published = AtomicU64::new(1);
    let started = Cell::new(false);
    let result = replace(
        &published,
        2,
        || {
            if requests.load(Ordering::SeqCst) == 2 {
                Ok(())
            } else {
                Err("cancelled".into())
            }
        },
        || {
            // Stop/Clear, another source or disconnect reserves its intent while the old output retires.
            requests.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
        || {
            started.set(true);
            Ok(())
        },
    );
    assert!(
        result.is_err(),
        "retired start was accepted after cancellation"
    );
    assert!(!started.get());
    assert_eq!(published.load(Ordering::SeqCst), 1);
}

#[test]
fn logout_while_retiring_output_prevents_playback_with_the_revoked_client() {
    retired_account_cannot_start(false);
}

#[test]
fn replacement_login_while_retiring_output_cannot_inherit_the_old_start() {
    retired_account_cannot_start(true);
}

fn retired_account_cannot_start(reconnect: bool) {
    let (client, replacement) = crate::account_test_support::sessions();
    let owner = Mutex::new(Some(client.clone()));
    let identity = AtomicU64::new(1);
    let published = AtomicU64::new(1);
    let started = Cell::new(false);
    let result = replace(
        &published,
        2,
        || crate::sessions::with_current(&owner, &identity, "1", &client, || Ok(())),
        || {
            crate::sessions::invalidate(&owner, &identity)?;
            if reconnect {
                crate::sessions::publish_login(&owner, &identity, 2, replacement.clone(), false)?;
            }
            Ok(())
        },
        || {
            started.set(true);
            Ok(())
        },
    );
    assert!(
        result.is_err(),
        "retired start was accepted after account change"
    );
    assert!(!started.get());
    assert_eq!(published.load(Ordering::SeqCst), 1);
}

#[test]
fn current_replacement_starts_only_after_the_old_output_has_stopped() {
    let published = AtomicU64::new(1);
    let playing = Cell::new("old");
    replace(
        &published,
        2,
        || Ok(()),
        || {
            playing.set("stopped");
            Ok(())
        },
        || {
            assert_eq!(playing.get(), "stopped");
            playing.set("new");
            Ok(())
        },
    )
    .expect("current replacement");
    assert_eq!(playing.get(), "new");
    assert_eq!(published.load(Ordering::SeqCst), 2);
}

#[test]
fn already_cancelled_replacement_leaves_current_output_untouched() {
    let published = AtomicU64::new(1);
    let touched = Cell::new(false);
    let result = replace(
        &published,
        2,
        || Err("cancelled".into()),
        || {
            touched.set(true);
            Ok(())
        },
        || {
            touched.set(true);
            Ok(())
        },
    );
    assert_eq!(result, Err("cancelled".into()));
    assert!(!touched.get());
    assert_eq!(published.load(Ordering::SeqCst), 1);
}

#[test]
fn failed_retirement_does_not_start_or_publish_a_replacement() {
    let published = AtomicU64::new(1);
    let started = Cell::new(false);
    let result = replace(
        &published,
        2,
        || Ok(()),
        || Err("stop failed".into()),
        || {
            started.set(true);
            Ok(())
        },
    );
    assert_eq!(result, Err("stop failed".into()));
    assert!(!started.get());
    assert_eq!(published.load(Ordering::SeqCst), 1);
}

#[test]
fn cd_account_change_while_retiring_output_prevents_anonymous_playback() {
    use std::sync::Arc;
    let (client, _) = crate::account_test_support::sessions();
    let owner = Arc::new(Mutex::new(Some(client)));
    let identity = Arc::new(AtomicU64::new(1));
    let captured = crate::cd_accounts::capture([(owner.clone(), identity.clone())])
        .expect("CD account snapshot");
    let published = AtomicU64::new(1);
    let started = Cell::new(false);
    let result = replace(
        &published,
        2,
        || crate::cd_accounts::admit(&captured, || Ok(())),
        || {
            assert!(
                owner.try_lock().is_ok(),
                "retirement must not hold account admission"
            );
            crate::sessions::invalidate(&owner, &identity)?;
            Ok(())
        },
        || {
            started.set(true);
            Ok(())
        },
    );
    assert!(result.is_err());
    assert!(!started.get());
    assert_eq!(published.load(Ordering::SeqCst), 1);
}

#[test]
fn refused_source_replacement_preserves_the_retained_track_namespace() {
    use phemios_core::federation::{Source, map};
    for failure in ["invalid PCM selection", "HQPlayer upload cancelled"] {
        let published = AtomicU64::new(1);
        let source = Mutex::new(Source::Server);
        let result = replace(
            &published,
            2,
            || Ok(()),
            || Ok(()),
            || with_source(&source, Source::Local, || Err::<(), _>(failure.into())),
        );
        assert_eq!(result, Err(failure.into()));
        // Stopped PCM retains its metadata; the public projection still uses this marker.
        let mut retained = serde_json::json!({"status":"idle", "reference":"track:retained"});
        map(&mut retained, *source.lock().expect("source"), true).expect("public projection");
        assert_eq!(
            retained["reference"], "track:@phemios/server/retained",
            "failed {failure} moved the previous track to the other catalogue"
        );
        assert_eq!(published.load(Ordering::SeqCst), 1);
    }
}

#[test]
fn accepted_source_replacement_publishes_origin_and_output_together() {
    use phemios_core::federation::Source;
    for (previous, next) in [
        (Source::Server, Source::Local),
        (Source::Local, Source::Server),
    ] {
        let source = Mutex::new(previous);
        let published = AtomicU64::new(1);
        let result = replace(
            &published,
            2,
            || Ok(()),
            || Ok(()),
            || with_source(&source, next, || Ok(42)),
        );
        assert_eq!(result, Ok(42));
        assert_eq!(*source.lock().expect("accepted origin"), next);
        assert_eq!(published.load(Ordering::SeqCst), 2);
    }
}

#[test]
fn hqplayer_handoff_discards_pcm_metadata_before_it_can_become_a_fallback() {
    use std::cell::RefCell;
    let local = RefCell::new(serde_json::json!({
        "status":"playing", "reference":"track:previous-pcm", "total":2, "queue":[0,1]
    }));
    let external_stops = Cell::new(0);
    stop_for_start(
        true,
        || {
            // PCM Halt keeps its selection, as the actual Player::halt contract requires.
            local.borrow_mut()["status"] = "idle".into();
            Ok(())
        },
        || {
            *local.borrow_mut() =
                serde_json::json!({"status":"idle", "reference":"", "total":0, "queue":[]});
            Ok(())
        },
        || {
            external_stops.set(external_stops.get() + 1);
            Ok(())
        },
    )
    .expect("retire before HQPlayer activation");
    // Stop and protocol failure release HQPlayer ownership; native state then falls back to PCM.
    assert_eq!(external_stops.get(), 1);
    let fallback = local.borrow();
    assert_eq!(fallback["status"], "idle");
    assert_eq!(
        fallback["reference"], "",
        "stopping HQPlayer resurrected the previous PCM track"
    );
    assert_eq!(fallback["total"], 0);
    assert_eq!(fallback["queue"], serde_json::json!([]));
}

#[test]
fn local_replacement_keeps_retained_metadata_until_its_own_activation() {
    let events = std::cell::RefCell::new(Vec::new());
    stop_for_start(
        false,
        || {
            events.borrow_mut().push("halt PCM");
            Ok(())
        },
        || panic!("ordinary local replacement must not change its retirement contract"),
        || {
            events.borrow_mut().push("halt HQPlayer");
            Ok(())
        },
    )
    .expect("ordinary local retirement");
    assert_eq!(*events.borrow(), ["halt PCM", "halt HQPlayer"]);
}

#[test]
fn refused_local_retirement_prevents_hqplayer_activation_and_preserves_failure() {
    let published = AtomicU64::new(1);
    let started = Cell::new(false);
    let result = replace(
        &published,
        2,
        || Ok(()),
        || {
            stop_for_start(
                true,
                || panic!("HQPlayer retirement must clear its obsolete fallback"),
                || Err("PCM stop was not confirmed".into()),
                || panic!("failed local retirement must preserve the existing external route"),
            )
        },
        || {
            started.set(true);
            Ok(())
        },
    );
    assert_eq!(result, Err("PCM stop was not confirmed".into()));
    assert!(!started.get());
    assert_eq!(published.load(Ordering::SeqCst), 1);
}
