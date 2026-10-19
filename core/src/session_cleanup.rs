//! Independent teardown steps after a session has already been invalidated.
/// Complete source teardown followed by credential revocation or engine shutdown.
/// Both failures must remain visible; callers invalidate the native owner first.
pub fn complete(
    cleanup: impl FnOnce() -> Result<(), String>,
    release: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    let cleanup = cleanup();
    let release = release();
    match (cleanup, release) {
        (Ok(()), Ok(())) => Ok(()),
        (Err(error), Ok(())) | (Ok(()), Err(error)) => Err(error),
        (Err(first), Err(second)) => Err(format!("{first}\n{second}")),
    }
}
#[cfg(test)]
#[path = "session_cleanup_tests.rs"]
mod tests;
