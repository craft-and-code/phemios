use super::*;
fn completed_signals() -> Signals {
    let signals = Signals::default();
    signals.finished.store(true, Ordering::Release);
    signals
}
#[test]
fn paused_and_empty_callbacks_do_not_acknowledge_silence_as_listening() {
    let (mut producer, mut consumer) = RingBuffer::new(4);
    producer.push([0.5, -0.5]).unwrap();
    let signals = completed_signals();
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
    let signals = completed_signals();
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
    let signals = completed_signals();
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
    let signals = completed_signals();
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
    let signals = completed_signals();
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

#[test]
fn reset_in_a_callback_keeps_its_consumed_frames_in_the_old_epoch() {
    let (mut producer, mut consumer) = RingBuffer::new(4);
    producer.push([0.5, -0.5]).unwrap();
    producer.push([0.5, -0.5]).unwrap();
    let signals = completed_signals();
    signals.paused.store(false, Ordering::Relaxed);
    let consumed = AtomicU64::new(10);
    let reset = Arc::new(super::super::transport::Reset::default());
    reset.requested.store(1, Ordering::Release);
    let mut transport = super::super::transport::Transport::new(48000, reset.clone());
    let mut samples = [0_f32; 8];
    render(
        &mut samples,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut super::super::spectrum::Spectrum::new(48000),
        &mut transport,
    );
    assert_eq!(reset.applied.load(Ordering::Acquire), 1);
    assert_eq!(reset.consumed.load(Ordering::Relaxed), 12);
    assert_eq!(consumed.load(Ordering::Relaxed), 0);
}

#[test]
fn startup_retains_a_small_reserve_before_consuming_pcm() {
    let (mut producer, mut consumer) = RingBuffer::new(24000);
    for _ in 0..128 {
        producer.push([0.5, -0.5]).unwrap();
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
    assert_eq!(samples, [0.; 512]);
    assert_eq!(consumed.load(Ordering::Relaxed), 0);
    assert_eq!(consumer.slots(), 128);
    for _ in 128..4800 {
        producer.push([0.5, -0.5]).unwrap();
    }
    render(
        &mut samples,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut spectrum,
        &mut transport,
    );
    assert_eq!(samples[0], 0.25);
    assert_eq!(consumed.load(Ordering::Relaxed), 256);
    assert_eq!(consumer.slots(), 4800 - 256);
}

#[test]
fn starvation_recovers_its_reserve_and_counts_all_held_output_frames() {
    let (mut producer, mut consumer) = RingBuffer::new(4000);
    let signals = Signals::default();
    signals.paused.store(false, Ordering::Relaxed);
    let consumed = AtomicU64::new(0);
    let mut spectrum = super::super::spectrum::Spectrum::new(8000);
    let mut transport = super::super::transport::Transport::new(8000, Arc::default());
    let mut samples = [0_f32; 512];
    for _ in 0..800 {
        producer.push([0.5, -0.5]).unwrap();
    }
    for _ in 0..4 {
        render(
            &mut samples,
            2,
            &mut consumer,
            &signals,
            &consumed,
            &mut spectrum,
            &mut transport,
        );
    }
    assert_eq!(consumed.load(Ordering::Relaxed), 800);
    assert_eq!(signals.underrun_frames.load(Ordering::Relaxed), 224);
    for _ in 0..100 {
        producer.push([0.5, -0.5]).unwrap();
    }
    render(
        &mut samples,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut spectrum,
        &mut transport,
    );
    assert_eq!(consumed.load(Ordering::Relaxed), 800);
    assert_eq!(consumer.slots(), 100);
    assert_eq!(signals.underrun_frames.load(Ordering::Relaxed), 480);
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
    assert_eq!(signals.underrun_frames.load(Ordering::Relaxed), 480);
    for _ in 100..800 {
        producer.push([0.5, -0.5]).unwrap();
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
    assert_eq!(consumed.load(Ordering::Relaxed), 1056);
    assert_eq!(signals.underrun_frames.load(Ordering::Relaxed), 480);
    assert!(samples[0].abs() < 0.01);
    assert_eq!(samples[510], 0.25);
}

#[test]
fn completed_short_sources_bypass_reserve_without_reporting_starvation() {
    let (mut producer, mut consumer) = RingBuffer::new(4000);
    let signals = Signals::default();
    signals.paused.store(false, Ordering::Relaxed);
    for _ in 0..10 {
        producer.push([0.5, -0.5]).unwrap();
    }
    let consumed = AtomicU64::new(0);
    let mut spectrum = super::super::spectrum::Spectrum::new(8000);
    let mut transport = super::super::transport::Transport::new(8000, Arc::default());
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
    assert_eq!(consumer.slots(), 10);
    assert_eq!(signals.underrun_frames.load(Ordering::Relaxed), 0);
    signals.finished.store(true, Ordering::Release);
    render(
        &mut samples,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut spectrum,
        &mut transport,
    );
    assert_eq!(consumed.load(Ordering::Relaxed), 10);
    assert_eq!(samples[0], 0.25);
    assert_eq!(samples[20], 0.);
    assert_eq!(signals.underrun_frames.load(Ordering::Relaxed), 0);
}

#[test]
fn reset_discards_the_old_reserve_and_holds_the_new_segment() {
    let (mut producer, mut consumer) = RingBuffer::new(4000);
    let signals = Signals::default();
    signals.paused.store(false, Ordering::Relaxed);
    let consumed = AtomicU64::new(0);
    let reset = Arc::new(super::super::transport::Reset::default());
    let mut spectrum = super::super::spectrum::Spectrum::new(8000);
    let mut transport = super::super::transport::Transport::new(8000, reset.clone());
    let mut samples = [0_f32; 512];
    for _ in 0..800 {
        producer.push([0.5, -0.5]).unwrap();
    }
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
    assert_eq!(consumer.slots(), 0);
    producer.push([-0.5, 0.5]).unwrap();
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
    assert_eq!(consumed.load(Ordering::Relaxed), 0);
    assert_eq!(consumer.slots(), 1);
    assert_eq!(signals.underrun_frames.load(Ordering::Relaxed), 0);
    assert_eq!(samples, [0.; 512]);
}

#[test]
fn brief_producer_stalls_fit_the_existing_ring_without_losing_samples_or_clock() {
    for rate in [8000, 48000, 192000] {
        let (mut producer, mut consumer) = RingBuffer::new((rate / 2) as usize);
        let signals = Signals::default();
        signals.paused.store(false, Ordering::Relaxed);
        let consumed = AtomicU64::new(0);
        let mut spectrum = super::super::spectrum::Spectrum::new(rate);
        let mut transport = super::super::transport::Transport::new(rate, Arc::default());
        let mut samples = [0_f32; 512];
        let cycle = (rate / 256 / 5).max(2) as usize;
        let stall = (rate / 256 / 25).max(1) as usize;
        let blocks = rate as usize * 2 / 256;
        for block in 0..blocks {
            if block % cycle >= stall || block == 0 {
                while producer.slots() > 0 {
                    producer.push([0.5, -0.5]).unwrap();
                }
            }
            render(
                &mut samples,
                2,
                &mut consumer,
                &signals,
                &consumed,
                &mut spectrum,
                &mut transport,
            );
            assert!(
                samples
                    .as_chunks::<2>()
                    .0
                    .iter()
                    .all(|sample| *sample == [0.25, -0.25])
            );
        }
        assert_eq!(consumed.load(Ordering::Relaxed), (blocks * 256) as u64);
        assert_eq!(signals.underrun_frames.load(Ordering::Relaxed), 0);
    }
}

#[test]
fn automatically_rerouted_output_keeps_consuming_pcm() {
    let (mut producer, mut consumer) = RingBuffer::new(512);
    for _ in 0..512 {
        producer.push([0.5, -0.5]).unwrap();
    }
    let signals = completed_signals();
    signals.paused.store(false, Ordering::Relaxed);
    let consumed = AtomicU64::new(0);
    let failed = AtomicBool::new(false);
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
    assert_eq!(consumed.load(Ordering::Relaxed), 256);
    record_error(&failed, cpal::ErrorKind::DeviceChanged);
    assert!(!failed.load(Ordering::Relaxed));
    assert!(!signals.paused.load(Ordering::Relaxed));
    render(
        &mut samples,
        2,
        &mut consumer,
        &signals,
        &consumed,
        &mut spectrum,
        &mut transport,
    );
    assert_eq!(consumed.load(Ordering::Relaxed), 512);
    assert!(
        samples
            .as_chunks::<2>()
            .0
            .iter()
            .all(|sample| *sample == [0.25, -0.25])
    );
}

#[test]
fn device_and_backend_faults_remain_fatal_after_a_later_reroute() {
    for kind in [
        cpal::ErrorKind::DeviceNotAvailable,
        cpal::ErrorKind::StreamInvalidated,
        cpal::ErrorKind::BackendError,
    ] {
        let failed = AtomicBool::new(false);
        record_error(&failed, kind);
        assert!(failed.load(Ordering::Relaxed));
        record_error(&failed, cpal::ErrorKind::DeviceChanged);
        assert!(failed.load(Ordering::Relaxed));
    }
}
