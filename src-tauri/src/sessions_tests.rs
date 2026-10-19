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

#[test]
fn captured_artwork_generations_refuse_guest_work_queued_before_login() {
    let (client, _) = sessions();
    let session = Mutex::new(None);
    let generation = AtomicU64::new(0);
    let ticket = generation.load(Ordering::SeqCst);
    publish_login(&session, &generation, ticket, client, false).unwrap();
    let reads = AtomicUsize::new(0);
    assert!(
        generation_dispatch(&session, &generation, ticket, || {
            reads.fetch_add(1, Ordering::SeqCst);
            Ok(vec![1, 2, 3])
        })
        .is_err()
    );
    assert_eq!(reads.load(Ordering::SeqCst), 0);
}

#[test]
fn late_artwork_cache_reads_and_failures_do_not_cross_login_or_logout() {
    let (client, _) = sessions();
    for authenticated in [false, true] {
        for failed in [false, true] {
            let session = Mutex::new(authenticated.then_some(client.clone()));
            let generation = AtomicU64::new(1);
            let result = generation_dispatch(&session, &generation, 1, || {
                if authenticated {
                    invalidate(&session, &generation).unwrap();
                } else {
                    publish_login(&session, &generation, 1, client.clone(), false).unwrap();
                }
                if failed {
                    Err("Earlier artwork error".into())
                } else {
                    Ok(vec![1, 2, 3])
                }
            });
            assert_eq!(
                result.unwrap_err(),
                "Session remplacée ou déconnectée. Reconnectez-vous."
            );
        }
    }
}

#[test]
fn generation_guard_rejects_publication_after_even_same_client_replacement() {
    let (client, _) = sessions();
    let session = Mutex::new(Some(client.clone()));
    let generation = AtomicU64::new(1);
    let ticket = generation.load(Ordering::SeqCst);
    publish_login(&session, &generation, ticket, client, true).unwrap();
    let writes = AtomicUsize::new(0);
    assert!(
        with_generation(&session, &generation, ticket, || {
            writes.fetch_add(1, Ordering::SeqCst);
            Ok(())
        })
        .is_err()
    );
    assert_eq!(writes.load(Ordering::SeqCst), 0);
    assert!(with_generation(&session, &generation, 2, || Ok(())).is_ok());
}

#[test]
fn rejected_remote_logins_retire_only_their_own_unpublished_credentials() {
    let (rejected, replacement) = sessions();
    for (ticket, held) in [(0, None), (1, Some(replacement.clone()))] {
        let session = Mutex::new(held.clone());
        let generation = AtomicU64::new(1);
        let released = AtomicUsize::new(0);
        let result =
            publish_remote_login(&session, &generation, ticket, rejected.clone(), |client| {
                assert!(client.same_session(&rejected));
                assert!(
                    session.try_lock().is_ok(),
                    "remote release must run outside the native owner lock"
                );
                released.fetch_add(1, Ordering::SeqCst);
                Ok(())
            });
        assert!(result.is_err());
        assert_eq!(
            released.load(Ordering::SeqCst),
            1,
            "rejected bearer token remained active remotely"
        );
        assert_eq!(generation.load(Ordering::SeqCst), 1);
        assert_eq!(
            session
                .lock()
                .unwrap()
                .as_ref()
                .map(|client| client.same_session(&replacement)),
            held.as_ref().map(|_| true)
        );
    }
}

#[test]
fn accepted_remote_login_keeps_its_token_and_rejected_revocation_errors_stay_visible() {
    let (client, rejected) = sessions();
    let session = Mutex::new(None);
    let generation = AtomicU64::new(0);
    let account = publish_remote_login(&session, &generation, 0, client.clone(), |_| {
        panic!("accepted login must not be revoked")
    })
    .unwrap();
    assert_eq!(account["nativeSession"], "1");
    assert!(
        session
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .same_session(&client)
    );
    let result = publish_remote_login(&session, &generation, 0, rejected, |_| {
        Err("revocation unavailable".into())
    });
    let failure = result.unwrap_err();
    assert!(failure.contains("Connexion annulée"));
    assert!(failure.contains("revocation unavailable"));
    assert_eq!(generation.load(Ordering::SeqCst), 1);
    assert!(
        session
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .same_session(&client)
    );
}

#[test]
fn private_file_mutations_require_live_write_rights_and_the_same_owner() {
    for (current, allowed) in [
        (json!({"id":"fixture","enabled":true,"role":"user"}), true),
        (json!({"id":"fixture","enabled":true,"role":"admin"}), true),
        (
            json!({"id":"fixture","enabled":true,"role":"auditor"}),
            false,
        ),
        (json!({"id":"fixture","enabled":false,"role":"user"}), false),
        (json!({"id":"other","enabled":true,"role":"admin"}), false),
    ] {
        let (client, peer) = crate::account_test_support::rechecked_session(current.clone());
        let session = Mutex::new(Some(client.clone()));
        let generation = AtomicU64::new(4);
        let writes = AtomicUsize::new(0);
        let result = private_write(&session, &generation, "4", &client, || {
            writes.fetch_add(1, Ordering::SeqCst);
            Ok(())
        });
        peer.join().unwrap();
        assert_eq!(result.is_ok(), allowed, "{current}");
        assert_eq!(writes.load(Ordering::SeqCst), usize::from(allowed));
    }
}
