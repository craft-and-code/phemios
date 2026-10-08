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

#[test]
fn meters_follow_consumed_stereo_samples_and_clear_on_pause_or_starvation() {
    let (mut producer, mut consumer) = RingBuffer::new(4);
    let signals = Signals::default();
    signals.paused.store(false, Ordering::Relaxed);
    signals.volume.store(0_f32.to_bits(), Ordering::Relaxed);
    producer.push([0.5, 0.25]).unwrap();
    producer.push([-0.5, -0.25]).unwrap();
    let consumed = AtomicU64::new(0);
    let mut output = [0.; 4];
    render(&mut output, 2, &mut consumer, &signals, &consumed);
    let levels = signals
        .levels
        .each_ref()
        .map(|v| f32::from_bits(v.load(Ordering::Relaxed)));
    assert_eq!(levels, [0.5, 0.5, 0.25, 0.25]);
    assert_eq!(output, [0.; 4]);
    render(&mut output, 2, &mut consumer, &signals, &consumed);
    assert!(
        signals
            .levels
            .iter()
            .all(|v| v.load(Ordering::Relaxed) == 0_f32.to_bits())
    );
    producer.push([1., 1.]).unwrap();
    signals.paused.store(true, Ordering::Relaxed);
    render(&mut output, 2, &mut consumer, &signals, &consumed);
    assert!(
        signals
            .levels
            .iter()
            .all(|v| v.load(Ordering::Relaxed) == 0_f32.to_bits())
    );
    assert_eq!(consumer.slots(), 1);
}
