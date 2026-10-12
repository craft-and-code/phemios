use super::*;
use crate::account_test_support::sessions;
use serde_json::json;
use std::sync::atomic::AtomicUsize;

#[test]
fn logout_cancels_pending_remote_login_and_local_start_publication() {
    let (first, _) = sessions();
    for replace in [false, true] {
        let session = Mutex::new(None);
        let generation = AtomicU64::new(0);
        let ticket = generation.load(Ordering::SeqCst);
        invalidate(&session, &generation).unwrap();
        assert!(publish_login(&session, &generation, ticket, first.clone(), replace).is_err());
        assert!(session.lock().unwrap().is_none());
        let ticket = generation.load(Ordering::SeqCst);
        assert!(publish_login(&session, &generation, ticket, first.clone(), replace).is_ok());
        assert!(
            session
                .lock()
                .unwrap()
                .as_ref()
                .unwrap()
                .same_session(&first)
        );
    }
}

#[test]
fn queued_private_mutations_never_dispatch_for_a_replaced_or_logged_out_client() {
    let (first, second) = sessions();
    let calls = AtomicUsize::new(0);
    for replacement in [None, Some(second.clone())] {
        let session = Mutex::new(replacement);
        let result = dispatch(&session, &first, || {
            calls.fetch_add(1, Ordering::SeqCst);
            Ok(json!({"saved": true}))
        });
        assert!(result.is_err());
        assert_eq!(calls.load(Ordering::SeqCst), 0);
    }
    let session = Mutex::new(Some(second.clone()));
    assert!(
        dispatch(&session, &second, || {
            calls.fetch_add(1, Ordering::SeqCst);
            Ok(json!({"saved": true}))
        })
        .is_ok()
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}

#[test]
fn in_flight_private_success_and_failure_are_not_published_after_logout() {
    let (first, _) = sessions();
    for failure in [false, true] {
        let session = Mutex::new(Some(first.clone()));
        let generation = AtomicU64::new(0);
        let result = dispatch(&session, &first, || {
            invalidate(&session, &generation).unwrap();
            if failure {
                Err("Old account response".into())
            } else {
                Ok(json!({"note": "Old account private note"}))
            }
        });
        assert_eq!(
            result.unwrap_err(),
            "Session remplacée ou déconnectée. Reconnectez-vous."
        );
        assert!(session.lock().unwrap().is_none());
    }
}

#[test]
fn queued_ipc_tickets_refuse_replacement_clients_before_capture_even_for_private_reads() {
    let (first, replacement) = sessions();
    let session = Mutex::new(Some(replacement.clone()));
    let generation = AtomicU64::new(2);
    let calls = AtomicUsize::new(0);
    for ticket in ["1", "", "wrong"] {
        assert!(
            scoped_dispatch(&session, &generation, Some(ticket), &replacement, || {
                calls.fetch_add(1, Ordering::SeqCst);
                Ok(())
            })
            .is_err()
        );
    }
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert!(
        scoped_dispatch(&session, &generation, Some("2"), &replacement, || {
            calls.fetch_add(1, Ordering::SeqCst);
            Ok(())
        })
        .is_ok()
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert!(
        scoped_dispatch(&session, &generation, Some("2"), &first, || {
            calls.fetch_add(1, Ordering::SeqCst);
            Ok(())
        })
        .is_err()
    );
    invalidate(&session, &generation).unwrap();
    assert!(
        scoped_dispatch(&session, &generation, Some("2"), &replacement, || {
            calls.fetch_add(1, Ordering::SeqCst);
            Ok(())
        })
        .is_err()
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
#[test]
fn a_same_client_generation_change_during_work_refuses_its_late_result() {
    let (client, _) = sessions();
    let session = Mutex::new(Some(client.clone()));
    let generation = AtomicU64::new(1);
    assert!(
        scoped_dispatch(&session, &generation, Some("1"), &client, || {
            generation.fetch_add(1, Ordering::SeqCst);
            Ok(json!({"private":"old generation"}))
        })
        .is_err()
    );
}

#[test]
fn a_completed_private_export_cannot_publish_after_logout_or_replacement() {
    let (client, replacement) = sessions();
    for successor in [None, Some(replacement)] {
        let session = Mutex::new(Some(client.clone()));
        let generation = AtomicU64::new(1);
        let publications = AtomicUsize::new(0);
        // A real command completed its network read before this local commit boundary.
        invalidate(&session, &generation).unwrap();
        *session.lock().unwrap() = successor;
        assert!(
            with_current(&session, &generation, "1", &client, || {
                publications.fetch_add(1, Ordering::SeqCst);
                Ok(())
            })
            .is_err()
        );
        assert_eq!(publications.load(Ordering::SeqCst), 0);
    }
}
