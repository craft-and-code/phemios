use super::*;
#[test]
fn linear_overlap_preserves_endpoints_and_never_adds_peak_gain() {
    assert_eq!(blend([1., -1.], [-1., 1.], 0, 5), [1., -1.]);
    assert_eq!(blend([1., -1.], [-1., 1.], 4, 5), [-1., 1.]);
    assert_eq!(blend([1., -1.], [-1., 1.], 2, 5), [0., 0.]);
    for frame in 0..1000 {
        assert_eq!(blend([1., -1.], [1., -1.], frame, 1000), [1., -1.]);
    }
}
#[test]
fn clocks_count_only_rendered_frames_including_each_overlap_voice() {
    assert_eq!(played(100, None, 40), 0);
    assert_eq!(played(99, Some(100), 40), 0);
    assert_eq!(played(120, Some(100), 40), 20);
    assert_eq!(played(150, Some(100), 40), 40);
    assert_eq!(played(150, Some(140), 30), 10);
}
#[test]
fn fade_is_bounded_by_both_track_lengths_and_remaining_source() {
    assert_eq!(overlap(5000, 48000, Some(2000), Some(1000), 0), 24000);
    assert_eq!(overlap(5000, 48000, Some(2000), Some(1000), 1800), 9600);
    assert_eq!(overlap(5000, 48000, None, Some(1000), 0), 0);
}

#[test]
fn seek_follows_consumed_audio_not_prebuffered_or_repeated_track_identity() {
    assert_eq!(audible(50, Some(0), Some(100), false), VoiceSlot::Current);
    assert_eq!(audible(100, Some(0), Some(100), false), VoiceSlot::Next);
    assert_eq!(audible(50, Some(100), None, true), VoiceSlot::Retired);
    assert_eq!(audible(100, Some(100), None, true), VoiceSlot::Current);
    assert_eq!(audible(0, None, None, false), VoiceSlot::Current);
}
