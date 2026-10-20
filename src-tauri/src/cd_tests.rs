use super::*;
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
