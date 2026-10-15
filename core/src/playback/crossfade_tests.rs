use super::*;

#[test]
fn removed_preload_candidate_never_opens_an_empty_stream_reference() {
    let state = Mutex::new(State {
        status: "playing",
        index: 0,
        total: 2,
        queue: vec![0, 1],
        tracks: vec!["track:current".into(), "track:successor".into()],
        ..State::default()
    });
    // Capture the successor, then apply the allowed concurrent non-current edit
    // before the producer opens a source for that captured slot.
    let candidate = state.lock().unwrap().queue[1];
    assert!(matches!(
        super::super::removal::edit(&mut state.lock().unwrap(), candidate, false).unwrap(),
        super::super::removal::Outcome::Keep
    ));
    assert_eq!(preload_reference(&state, candidate).unwrap(), None);
    assert_eq!(preload_reference(&state, usize::MAX).unwrap(), None);
    assert_eq!(
        preload_reference(&state, 0).unwrap(),
        Some("track:current".into())
    );
}
