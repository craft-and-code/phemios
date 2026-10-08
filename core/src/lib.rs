//! Framework-independent Phémios client policies.
#![warn(missing_docs)]
pub mod cache;
pub mod download;
pub mod network;

/// Current typed IPC contract understood by the web frontend.
pub const BRIDGE_VERSION: u32 = 1;

/// Validate the browser bridge before accepting a future native operation.
pub fn validate_bridge(version: u32) -> Result<(), &'static str> {
    if version == BRIDGE_VERSION {
        Ok(())
    } else {
        Err("Incompatible Phémios desktop bridge. Update the application.")
    }
}

#[cfg(test)]
#[path = "lib_tests.rs"]
mod tests;

pub mod playback;
