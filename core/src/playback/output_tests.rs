use super::*;
#[test]
fn paused_and_empty_callbacks_do_not_acknowledge_silence_as_listening() {
    let (mut producer, mut consumer) = RingBuffer::new(4);
    producer.push([0.5, -0.5]).unwrap();
    let signals = Signals::default();
    let consumed = AtomicU64::new(0);
    let mut samples = [1.; 4];
    render(&mut samples, 2, &mut consumer, &signals, &consumed);
    assert_eq!(samples, [0.; 4]);
    assert_eq!(consumed.load(Ordering::Relaxed), 0);
    signals.paused.store(false, Ordering::Relaxed);
    render(&mut samples, 2, &mut consumer, &signals, &consumed);
    assert_eq!(samples, [0.25, -0.25, 0., 0.]);
    assert_eq!(consumed.load(Ordering::Relaxed), 1);
}
