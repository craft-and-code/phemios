use super::*;
#[test]
fn ejection_never_dispatches_for_unknown_ids_or_during_a_transfer() {
    let state = Transfers::default();
    assert!(
        eject(&state, "mount:1", |_, _| panic!(
            "unknown device must not eject"
        ))
        .is_err()
    );
    state.running.store(true, Ordering::Release);
    assert!(
        eject(&state, "mount:1", |_, _| panic!(
            "running transfer must not eject"
        ))
        .is_err()
    );
    state.running.store(false, Ordering::Release);
    let _lease = state.idle_destinations().unwrap();
    assert!(
        eject(&state, "mount:1", |_, _| panic!(
            "another operation owns destinations"
        ))
        .is_err()
    );
}
