//! Local DSP transport policy: convex mixing has no added peak gain.
pub(super) use aede_audio::dsp::mix::{blend, overlap};
pub(super) fn played(consumed: u64, start: Option<u64>, supplied: u64) -> u64 {
    start.map_or(0, |start| consumed.saturating_sub(start).min(supplied))
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
