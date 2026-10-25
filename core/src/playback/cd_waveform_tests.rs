use super::*;
#[test]
fn bounded_envelope_measures_exact_buckets_and_keeps_unread_regions_absent() {
    let mut wave = Envelope::new("track:cd/0000000000000001/3", 44100 * 2);
    assert!(wave.peaks.len() <= 1024);
    assert!(wave.peaks.iter().all(Option::is_none));
    wave.record(0, [[-0.5, 0.25], [0.1, -0.75]].into_iter());
    assert_eq!(wave.peaks[0], Some(0.75));
    assert_eq!(wave.peaks[1], None);
    let offset = wave.bucket_frames * 5;
    wave.record(offset, [[0.2, 0.4]].into_iter());
    assert_eq!(wave.peaks[0], Some(0.75));
    assert_eq!(wave.peaks[4], None);
    assert_eq!(wave.peaks[5], Some(0.4));
    wave.record(0, [[0.1, 0.2]].into_iter());
    assert_eq!(wave.peaks[0], Some(0.75));
    wave.record(u64::MAX, [[1., 1.]].into_iter());
    assert_eq!(wave.peaks.last(), Some(&None));
}
#[test]
fn frame_boundaries_do_not_merge_neighbouring_buckets_or_invent_read_silence() {
    let mut wave = Envelope::new("track:cd/0000000000000001/7", 2048);
    wave.record(1, [[-0.5, 0.2], [0., 0.]].into_iter());
    assert_eq!(&wave.peaks[..3], &[Some(0.5), Some(0.), None]);
    wave.record(2047, [[0.4, 0.2], [1., 1.]].into_iter());
    assert_eq!(wave.peaks.last(), Some(&Some(0.4)));
    assert_eq!(wave.peaks.len(), 1024);
}

#[test]
fn snapshots_keep_paused_envelopes_and_never_publish_them_for_another_track() {
    let player = super::super::Player::default();
    let reference = "track:cd/0000000000000001/3";
    {
        let mut state = player.state.lock().unwrap();
        state.local_cd = true;
        state.reference = reference.into();
        state.status = "paused";
        let mut wave = Envelope::new(reference, 44100);
        wave.record(0, [[0.5, 0.2]].into_iter());
        state.cd_waveform = Some(wave);
    }
    let snapshot = player.snapshot().unwrap();
    assert_eq!(snapshot["cd_waveform"]["reference"], reference);
    assert_eq!(snapshot["cd_waveform"]["peaks"][0], 0.5);
    player.state.lock().unwrap().reference = "track:cd/0000000000000001/7".into();
    assert!(player.snapshot().unwrap()["cd_waveform"].is_null());
    player.state.lock().unwrap().clear_selection();
    assert!(player.snapshot().unwrap()["cd_waveform"].is_null());
}
