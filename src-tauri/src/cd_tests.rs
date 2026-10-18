use super::*;
use crate::aede::SourceState;
fn source(client: Option<phemios_core::network::Client>) -> SourceState {
    SourceState {
        session: Arc::new(Mutex::new(client)),
        generation: Arc::default(),
        cache: phemios_core::cache::Cache::new(
            std::env::temp_dir().join("unused-cd-admission-fixture"),
        ),
        snapshot: Arc::default(),
    }
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

#[test]
fn ejection_does_not_interrupt_a_disc_that_started_after_the_ui_was_rendered() {
    for status in ["connecting", "playing"] {
        let playing = json!({"source":"cd", "cd_disc":"fixture", "status":status});
        assert!(require_eject_idle(&playing, Some("fixture")).is_err());
        assert!(require_eject_idle(&playing, Some("other-drive")).is_ok());
        assert!(require_eject_idle(&playing, None).is_ok());
    }
    for status in ["paused", "ended", "idle", "error"] {
        assert!(
            require_eject_idle(
                &json!({"source":"cd", "cd_disc":"fixture", "status":status}),
                Some("fixture")
            )
            .is_ok()
        );
    }
    assert!(
        require_eject_idle(
            &json!({"source":"aede", "status":"playing"}),
            Some("fixture")
        )
        .is_ok()
    );
}
