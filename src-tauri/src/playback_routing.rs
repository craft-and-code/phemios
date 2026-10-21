//! Serialize native control admission against output replacement without requiring Tauri or a device.
use std::sync::{
    Mutex,
    atomic::{AtomicU64, Ordering},
};

/// Transport gestures target the accepted output present when IPC is admitted, not a successor.
/// Absolute gain and future-playback settings retain their scope; mute toggles and live reroutes do not.
pub(crate) fn targets_output(action: &str) -> bool {
    matches!(
        action,
        "seek"
            | "pause"
            | "resume"
            | "next"
            | "previous"
            | "jump"
            | "shuffle"
            | "queue"
            | "remove"
            | "mute"
            | "output"
    )
}

/// Recheck controls only after taking the routing lock; queued work can run out of order.
pub(crate) fn control<T>(
    routing: &Mutex<()>,
    published: &AtomicU64,
    generation: Option<u64>,
    action: &str,
    work: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let _guard = routing.lock().map_err(|_| "État audio indisponible.")?;
    if matches!(action, "stop" | "clear")
        && generation.is_none_or(|ticket| published.load(Ordering::SeqCst) > ticket)
    {
        return Err("La liste de lecture a changé.".into());
    }
    if targets_output(action) && generation != Some(published.load(Ordering::SeqCst)) {
        return Err("La liste de lecture a changé.".into());
    }
    work()
}

/// Record only a successfully accepted output; callers already own routing.
pub(crate) fn publish<T>(
    published: &AtomicU64,
    generation: u64,
    work: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let value = work()?;
    published.store(generation, Ordering::SeqCst);
    Ok(value)
}

/// Replace output under caller-owned routing; retirement may wait for network or worker shutdown.
pub(crate) fn replace<T>(
    published: &AtomicU64,
    generation: u64,
    admit: impl Fn() -> Result<(), String>,
    stop: impl FnOnce() -> Result<(), String>,
    start: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    admit()?;
    stop()?;
    admit()?;
    publish(published, generation, start)
}

/// Retire both engines; HQPlayer must not leave an old PCM/CD selection as its idle fallback.
/// Clearing the retired selection retains the local player's gain and output settings.
pub(crate) fn stop_for_start(
    to_hqplayer: bool,
    halt_local: impl FnOnce() -> Result<(), String>,
    clear_local: impl FnOnce() -> Result<(), String>,
    halt_hqplayer: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    if to_hqplayer {
        clear_local()?;
    } else {
        halt_local()?;
    }
    halt_hqplayer()
}

/// Publish the catalogue origin together with output activation under caller-owned routing.
pub(crate) fn with_source<T>(
    source: &Mutex<phemios_core::federation::Source>,
    origin: phemios_core::federation::Source,
    work: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let mut held = source.lock().map_err(|_| "État audio indisponible.")?;
    let value = work()?;
    *held = origin;
    Ok(value)
}

/// Session teardown still revokes its captured credentials independently of audio cleanup.
pub(crate) fn retire(
    routing: &Mutex<()>,
    published: &AtomicU64,
    generation: u64,
    work: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    let _guard = routing.lock().map_err(|_| "État audio indisponible.")?;
    // A pending or refused replacement cannot exempt old audio from logout cleanup.
    if published.load(Ordering::SeqCst) >= generation {
        return Ok(());
    }
    work()
}

#[cfg(test)]
#[path = "playback_routing_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "playback_replacement_tests.rs"]
mod replacement_tests;
