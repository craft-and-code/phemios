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

pub mod radio;

pub mod federation;
pub mod local;

/// Shared native service-key request policy.
pub mod enrichment;

/// Read-only discovery of OS-mounted player/card/drive destinations.
pub mod volumes;

pub mod podcast;

/// Explicit LAN control of a separately installed HQPlayer engine.
pub mod hqplayer;

/// Explicit streaming downloads of public podcast enclosures.
pub mod podcast_download;

/// Explicit attributed public encyclopedia retrieval.
pub mod encyclopedia;
