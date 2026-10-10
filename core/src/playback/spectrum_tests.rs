use super::*;
#[test]
fn stereo_frequency_bank_distinguishes_low_and_high_tones_without_phase_cancellation() {
    for target in [4, 18] {
        let hz = frequencies()[target];
        let mut bank = Spectrum::new(48000);
        for i in 0..48000 {
            let x = (2. * PI * f64::from(hz) * i as f64 / 48000.).sin() as f32 * 0.3;
            bank.push([x, -x]);
        }
        let values = bank.finish();
        let maximum = values
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
            .unwrap()
            .0;
        assert_eq!(maximum, target);
        assert!(values[target] > 0.3);
        assert_eq!(bank.finish(), [0.; 24]);
    }
}
#[test]
fn unavailable_nyquist_bands_and_silence_never_invent_spectrum_energy() {
    let mut bank = Spectrum::new(8000);
    for _ in 0..8000 {
        bank.push([0., 0.]);
    }
    assert_eq!(bank.finish(), [0.; 24]);
    for i in 0..8000 {
        let x = (i as f32 * 0.5).sin() * 0.5;
        bank.push([x, x]);
    }
    let values = bank.finish();
    for (i, hz) in frequencies().iter().enumerate() {
        if *hz >= 3600. {
            assert_eq!(values[i], 0.);
        }
    }
}
