use super::*;
use serde_json::json;
use std::sync::atomic::AtomicU64;
struct Source {
    session: Arc<Mutex<Option<phemios_core::network::Client>>>,
    generation: Arc<AtomicU64>,
}
fn source(client: Option<phemios_core::network::Client>) -> Source {
    Source {
        session: Arc::new(Mutex::new(client)),
        generation: Arc::default(),
    }
}
fn capture(sources: &[&Source]) -> Result<Vec<Stamp>, String> {
    super::capture(
        sources
            .iter()
            .map(|source| (source.session.clone(), source.generation.clone())),
    )
}
fn permission(sources: &[&Source]) -> Result<Box<dyn Fn() -> Result<(), String> + Send>, String> {
    Ok(super::permission(capture(sources)?))
}

#[test]
fn cd_policy_busy_retries_stop_on_logout_same_account_replacement_or_other_source_login() {
    for status in [409, 429, 503] {
        for retirement in ["logout", "replacement", "other-source"] {
            let fixture = crate::snapshots::test_support::policy_server(status, false);
            let session = Arc::new(Mutex::new(Some(fixture.client.clone())));
            let generation = Arc::new(AtomicU64::new(1));
            let other = Arc::new(Mutex::new(None));
            let other_generation = Arc::new(AtomicU64::new(1));
            let check = super::permission(vec![
                (
                    session.clone(),
                    generation.clone(),
                    1,
                    Some(fixture.client.clone()),
                ),
                (other.clone(), other_generation.clone(), 1, None),
            ]);
            let running = std::thread::spawn(check);
            fixture
                .pending
                .recv_timeout(std::time::Duration::from_secs(5))
                .unwrap();
            if retirement == "other-source" {
                *other.lock().unwrap() = Some(fixture.replacement.clone());
                other_generation.fetch_add(1, Ordering::SeqCst);
            } else {
                *session.lock().unwrap() = if retirement == "replacement" {
                    Some(fixture.replacement.clone())
                } else {
                    None
                };
                generation.fetch_add(1, Ordering::SeqCst);
            }
            fixture.resume.send(()).unwrap();
            let result = running.join().unwrap();
            fixture.stop.send(()).unwrap();
            let paths = fixture.worker.join().unwrap();
            assert!(result.is_err(), "{status}/{retirement}");
            assert_eq!(
                paths,
                ["/api/me/v1/parental"],
                "retired CD policy retried after {retirement}/{status}"
            );
        }
    }
}

#[test]
fn current_cd_policy_retries_busy_status_and_keeps_supervision_enforced() {
    for enabled in [false, true] {
        let fixture = crate::snapshots::test_support::policy_server(503, enabled);
        let session = Arc::new(Mutex::new(Some(fixture.client.clone())));
        let generation = Arc::new(AtomicU64::new(1));
        let check = super::permission(vec![(session, generation, 1, Some(fixture.client.clone()))]);
        fixture.resume.send(()).unwrap();
        let result = check();
        fixture.stop.send(()).unwrap();
        assert_eq!(
            fixture.worker.join().unwrap(),
            ["/api/me/v1/parental", "/api/me/v1/parental"]
        );
        if enabled {
            assert!(result.unwrap_err().contains("compte supervisé"));
        } else {
            result.unwrap();
        }
    }
}

#[test]
fn cd_policy_repeated_checks_keep_live_rights_without_a_grace_cache() {
    let fixture = crate::snapshots::test_support::policy_server(200, false);
    let session = Arc::new(Mutex::new(Some(fixture.client.clone())));
    let generation = Arc::new(AtomicU64::new(1));
    let check = super::permission(vec![(session, generation, 1, Some(fixture.client))]);
    fixture.resume.send(()).unwrap();
    check().unwrap();
    check().unwrap();
    fixture.stop.send(()).unwrap();
    assert_eq!(fixture.worker.join().unwrap().len(), 2);
}

#[test]
fn guest_disc_permission_needs_no_server_and_rejects_a_later_login() {
    let owner = source(None);
    let check = permission(&[&owner]).unwrap();
    check().unwrap();
    let (client, _) = crate::account_test_support::sessions();
    *owner.session.lock().unwrap() = Some(client);
    assert!(check().is_err());
}
#[test]
fn replacing_credentials_for_the_same_account_does_not_reuse_disc_permission() {
    let (first, second) = crate::account_test_support::sessions();
    let owner = source(Some(first));
    let check = permission(&[&owner]).unwrap();
    check().unwrap();
    *owner.session.lock().unwrap() = Some(second);
    assert!(check().is_err());
}
#[test]
fn a_native_session_generation_change_retires_anonymous_admission() {
    let owner = source(None);
    let check = permission(&[&owner]).unwrap();
    owner.generation.fetch_add(1, Ordering::SeqCst);
    assert!(check().is_err());
}

#[test]
fn changed_session_admission_cannot_publish_audio_after_an_earlier_policy_check() {
    let source = source(None);
    let held = capture(&[&source]).unwrap();
    source.generation.fetch_add(1, Ordering::SeqCst);
    let called = std::cell::Cell::new(false);
    assert!(
        admit(&held, || {
            called.set(true);
            Ok(())
        })
        .is_err()
    );
    assert!(!called.get());
}

#[path = "cd_test_support.rs"]
mod support;
#[test]
fn live_supervision_overrides_an_old_unrestricted_login_without_guest_fallback() {
    for (role, enabled, accepted) in [
        ("user", true, false),
        ("user", false, true),
        ("auditor", false, false),
        ("admin", false, true),
    ] {
        let policy=(role=="user").then(||json!({"owner":"fixture-cd","revision":1,"policy":{"enabled":enabled},"allowed":true}));
        let (client, server) = support::session(role, policy);
        let owner = source(Some(client));
        let check = permission(&[&owner]).unwrap();
        assert_eq!(check().is_ok(), accepted, "role={role},enabled={enabled}");
        server.join().unwrap();
    }
}
