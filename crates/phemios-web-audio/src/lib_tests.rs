use super::*;
#[test]
fn shared_dsp_retains_samples_at_unity_then_applies_volume_and_exact_mute() {
    let mut dsp = WebDsp::create(48000).unwrap();
    dsp.samples[..512].fill(0.5);
    assert!(dsp.process(256));
    assert!(dsp.samples[..512].iter().all(|&s| s == 0.5));
    assert!(dsp.set_volume(0.5));
    assert!(dsp.process(256));
    assert!((dsp.samples[511] - 0.25).abs() < 0.00001);
    assert!(dsp.set_volume(0.0));
    dsp.samples[..256].fill(0.5);
    assert!(dsp.process(128));
    assert!(dsp.samples[..256].iter().all(|&s| s == 0.0));
}
#[test]
fn invalid_formats_gain_and_blocks_are_refused_without_unbounded_memory() {
    assert!(WebDsp::create(0).is_none());
    assert!(WebDsp::create(192001).is_none());
    let mut dsp = WebDsp::create(44100).unwrap();
    let pointer = dsp.buffer_ptr();
    for volume in [f32::NAN, f32::INFINITY, -0.1, 1.1] {
        assert!(!dsp.set_volume(volume));
    }
    assert!(!dsp.process(4097));
    assert!(!dsp.process(usize::MAX));
    dsp.samples[0] = f32::NAN;
    assert!(!dsp.process(128));
    assert!(dsp.samples[..256].iter().all(|&s| s == 0.0));
    assert_eq!(dsp.buffer_ptr(), pointer);
    assert_eq!(dsp.buffer_len(), 8192);
}
