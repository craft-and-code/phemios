//! A short read may finish after Next/Stop; wait off the audio thread without opening a second handle.
use std::{
    sync::{Mutex, MutexGuard, TryLockError},
    time::{Duration, Instant},
};
pub(super) fn lock(
    gate: &Mutex<()>,
    current: impl Fn() -> bool,
) -> Result<MutexGuard<'_, ()>, String> {
    let deadline = Instant::now() + Duration::from_secs(2);
    loop {
        if !current() {
            return Err("Lecture CD annulée.".into());
        }
        match gate.try_lock() {
            Ok(guard) => return Ok(guard),
            Err(TryLockError::WouldBlock) if Instant::now() < deadline => {
                std::thread::sleep(Duration::from_millis(2))
            }
            Err(_) => return Err("Le lecteur CD termine une opération. Réessayez.".into()),
        }
    }
}
#[cfg(test)]
#[path = "access_tests.rs"]
mod tests;
