//! Local DSP transport policy: convex mixing has no added peak gain.
pub(super) fn blend(a: [f32; 2], b: [f32; 2], frame: u64, total: u64) -> [f32; 2] {
    let gain = if total <= 1 {
        1.
    } else {
        (frame.min(total - 1) as f64 / (total - 1) as f64) as f32
    };
    std::array::from_fn(|channel| a[channel] * (1. - gain) + b[channel] * gain)
}
pub(super) fn played(consumed: u64, start: Option<u64>, supplied: u64) -> u64 {
    start.map_or(0, |start| consumed.saturating_sub(start).min(supplied))
}
pub(super) fn overlap(
    ms: u64,
    rate: u32,
    outgoing: Option<u64>,
    incoming: Option<u64>,
    position: u64,
) -> u64 {
    let (Some(outgoing), Some(incoming)) = (outgoing, incoming) else {
        return 0;
    };
    ms.min(outgoing / 2)
        .min(incoming / 2)
        .min(outgoing.saturating_sub(position))
        .saturating_mul(u64::from(rate))
        / 1000
}
#[cfg(test)]
#[path = "crossfade_mix_tests.rs"]
mod tests;

#[derive(Debug, PartialEq, Eq)]
pub(super) enum VoiceSlot {
    Current,
    Next,
    Retired,
}
/// Attribute actions to consumed overlap audio, even when the same track repeats.
pub(super) fn audible(
    consumed: u64,
    current: Option<u64>,
    next: Option<u64>,
    retired: bool,
) -> VoiceSlot {
    if next.is_some_and(|start| start <= consumed) {
        VoiceSlot::Next
    } else if retired && current.is_none_or(|start| start > consumed) {
        VoiceSlot::Retired
    } else {
        VoiceSlot::Current
    }
}
