use super::*;
#[test]
fn album_queues_reuse_one_output_without_enabling_dsp() {
    assert!(continuous_queue(super::super::Policy::WithoutEffects, 2));
    assert!(continuous_queue(super::super::Policy::Dsp, 1));
    assert!(!continuous_queue(super::super::Policy::WithoutEffects, 1));
}
