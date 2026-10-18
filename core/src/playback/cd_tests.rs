use super::*;
#[test]
fn cd_policy_controls_neither_mute_nor_queue_an_unsupported_processing_restart() {
    let player = Player::default();
    player.state.lock().unwrap().local_cd = true;
    player.signals.paused.store(false, Ordering::Relaxed);
    assert!(player.control("policy", json!("without-effects")).is_ok());
    assert!(!player.signals.paused.load(Ordering::Relaxed));
    assert!(player.control("policy", json!("dsp")).is_err());
    assert!(!player.signals.paused.load(Ordering::Relaxed));
    assert!(player.is_cd().unwrap());
    player.clear().unwrap();
    assert!(!player.is_cd().unwrap());
}
