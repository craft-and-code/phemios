//! Serialize native control admission against output replacement without requiring Tauri or a device.
use std::sync::{
    Mutex,
    atomic::{AtomicU64, Ordering},
};

/// Recheck retiring controls only after taking the routing lock; queued work can run out of order.
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
