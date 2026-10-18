use super::*;
#[test]
fn a_cancelled_selection_never_takes_a_drive_even_when_it_becomes_free() {
    let gate = Mutex::new(());
    let held = gate.lock().unwrap();
    assert!(lock(&gate, || false).is_err());
    drop(held);
    assert!(lock(&gate, || false).is_err());
    assert!(lock(&gate, || true).is_ok());
}
#[test]
fn waiting_for_an_ending_read_does_not_open_a_second_drive_handle() {
    let gate = std::sync::Arc::new(Mutex::new(()));
    let held = gate.lock().unwrap();
    let next = gate.clone();
    let waiting = std::thread::spawn(move || {
        let _guard = lock(&next, || true).unwrap();
    });
    drop(held);
    waiting.join().unwrap();
}
