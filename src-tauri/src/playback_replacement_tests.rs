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
