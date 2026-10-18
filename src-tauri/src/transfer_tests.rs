use super::*;
#[test]
fn destination_mutations_refuse_running_jobs_and_simultaneous_operations() {
    let state = Transfers::default();
    let lease = state.idle_destinations().unwrap();
    assert!(state.idle_destinations().is_err());
    drop(lease);
    state.running.store(true, Ordering::Release);
    assert!(state.idle_destinations().is_err());
    state.running.store(false, Ordering::Release);
    assert!(state.idle_destinations().is_ok());
}
