use super::*;
#[test]
fn paused_and_empty_callbacks_do_not_acknowledge_silence_as_listening() {
    let (mut producer, mut consumer) = RingBuffer::new(4);
    producer.push([0.5, -0.5]).unwrap();
    let signals = Signals::default();
    let consumed = AtomicU64::new(0);
    let mut samples = [1.; 4];
    render(
        &mut samples,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut super::super::spectrum::Spectrum::new(48000),
        &mut super::super::transport::Transport::new(48000, Arc::default()),
    );
    assert_eq!(samples, [0.; 4]);
    assert_eq!(consumed.load(Ordering::Relaxed), 0);
    signals.paused.store(false, Ordering::Relaxed);
    render(
        &mut samples,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut super::super::spectrum::Spectrum::new(48000),
        &mut super::super::transport::Transport::new(48000, Arc::default()),
    );
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
    render(
        &mut output,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut super::super::spectrum::Spectrum::new(48000),
        &mut super::super::transport::Transport::new(48000, Arc::default()),
    );
    let levels = signals
        .levels
        .each_ref()
        .map(|v| f32::from_bits(v.load(Ordering::Relaxed)));
    assert_eq!(levels, [0.5, 0.5, 0.25, 0.25]);
    assert_eq!(output, [0.; 4]);
    render(
        &mut output,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut super::super::spectrum::Spectrum::new(48000),
        &mut super::super::transport::Transport::new(48000, Arc::default()),
    );
    assert!(
        signals
            .levels
            .iter()
            .all(|v| v.load(Ordering::Relaxed) == 0_f32.to_bits())
    );
    producer.push([1., 1.]).unwrap();
    signals.paused.store(true, Ordering::Relaxed);
    render(
        &mut output,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut super::super::spectrum::Spectrum::new(48000),
        &mut super::super::transport::Transport::new(48000, Arc::default()),
    );
    assert!(
        signals
            .levels
            .iter()
            .all(|v| v.load(Ordering::Relaxed) == 0_f32.to_bits())
    );
    assert_eq!(consumer.slots(), 1);
}

#[test]
fn equalizer_level_measures_written_output_with_flaccompagnon_gain() {
    let (mut producer, mut consumer) = RingBuffer::new(4);
    let signals = Signals::default();
    signals.paused.store(false, Ordering::Relaxed);
    producer.push([0.5, 0.25]).unwrap();
    let mut output = [0_f32; 2];
    render(
        &mut output,
        2,
        &mut consumer,
        &signals,
        &AtomicU64::new(0),
        &mut super::super::spectrum::Spectrum::new(48000),
        &mut super::super::transport::Transport::new(48000, Arc::default()),
    );
    let expected = ((0.25_f32.powi(2) + 0.125_f32.powi(2)) / 2.).sqrt() * 4.;
    assert!((f32::from_bits(signals.level.load(Ordering::Relaxed)) - expected).abs() < 0.00001);
    signals.volume.store(0_f32.to_bits(), Ordering::Relaxed);
    producer.push([1., 1.]).unwrap();
    render(
        &mut output,
        2,
        &mut consumer,
        &signals,
        &AtomicU64::new(0),
        &mut super::super::spectrum::Spectrum::new(48000),
        &mut super::super::transport::Transport::new(48000, Arc::default()),
    );
    assert_eq!(signals.level.load(Ordering::Relaxed), 0_f32.to_bits());
}

#[test]
fn pause_ramps_to_silence_without_counting_or_discarding_pending_audio() {
    let (mut producer, mut consumer) = RingBuffer::new(1024);
    for _ in 0..512 {
        producer.push([0.8, 0.8]).unwrap();
    }
    let signals = Signals::default();
    signals.paused.store(false, Ordering::Relaxed);
    let consumed = AtomicU64::new(0);
    let mut spectrum = super::super::spectrum::Spectrum::new(48000);
    let mut transport = super::super::transport::Transport::new(48000, Arc::default());
    let mut samples = [0_f32; 512];
    render(
        &mut samples,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut spectrum,
        &mut transport,
    );
    let previous = samples[510];
    signals.paused.store(true, Ordering::Relaxed);
    render(
        &mut samples,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut spectrum,
        &mut transport,
    );
    assert!((samples[0] - previous).abs() < 0.005);
    assert!(
        samples
            .as_chunks::<2>()
            .0
            .iter()
            .map(|s| s[0])
            .collect::<Vec<_>>()
            .windows(2)
            .all(|s| (s[0] - s[1]).abs() < 0.005)
    );
    assert_eq!(samples[510], 0.);
    assert_eq!(consumed.load(Ordering::Relaxed), 256);
    assert_eq!(consumer.slots(), 256);
}

#[test]
fn seek_flush_preserves_consumed_evidence_and_ramps_only_the_new_segment() {
    let (mut producer, mut consumer) = RingBuffer::new(1024);
    for _ in 0..512 {
        producer.push([0.8, 0.8]).unwrap();
    }
    let signals = Signals::default();
    signals.paused.store(false, Ordering::Relaxed);
    let consumed = AtomicU64::new(0);
    let reset = Arc::new(super::super::transport::Reset::default());
    let mut transport = super::super::transport::Transport::new(48000, reset.clone());
    let mut spectrum = super::super::spectrum::Spectrum::new(48000);
    let mut samples = [0_f32; 512];
    render(
        &mut samples,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut spectrum,
        &mut transport,
    );
    signals.paused.store(true, Ordering::Relaxed);
    reset.requested.store(1, Ordering::Release);
    render(
        &mut samples,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut spectrum,
        &mut transport,
    );
    assert_eq!(reset.applied.load(Ordering::Acquire), 1);
    assert_eq!(reset.consumed.load(Ordering::Relaxed), 256);
    assert_eq!(consumed.load(Ordering::Relaxed), 0);
    assert_eq!(consumer.slots(), 0);
    for _ in 0..256 {
        producer.push([-0.8, -0.8]).unwrap();
    }
    signals.paused.store(false, Ordering::Relaxed);
    render(
        &mut samples,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut spectrum,
        &mut transport,
    );
    assert!(samples[0].abs() < 0.005);
    assert!(
        samples
            .as_chunks::<2>()
            .0
            .iter()
            .map(|s| s[0])
            .collect::<Vec<_>>()
            .windows(2)
            .all(|s| (s[0] - s[1]).abs() < 0.005)
    );
    assert_eq!(samples[510], -0.4);
    assert_eq!(consumed.load(Ordering::Relaxed), 256);
}
