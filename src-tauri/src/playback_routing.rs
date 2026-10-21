//! Serialize native control admission against output replacement without requiring Tauri or a device.
use std::sync::{
    Mutex,
    atomic::{AtomicU64, Ordering},
};

/// Recheck retiring controls only after taking the routing lock; queued work can run out of order.
pub(crate) fn control<T>(
    routing: &Mutex<()>,
    epoch: &AtomicU64,
    generation: Option<u64>,
    action: &str,
    work: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let _guard = routing.lock().map_err(|_| "État audio indisponible.")?;
    if matches!(action, "stop" | "clear") && generation != Some(epoch.load(Ordering::SeqCst)) {
        return Err("La liste de lecture a changé.".into());
    }
    work()
}

#[cfg(test)]
#[path = "playback_routing_tests.rs"]
mod tests;
