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

/// Validated system-browser handoff for explicit public source links.
pub mod external_links;

/// Explicit upcoming live music claims from a configured public provider.
pub mod concerts;

/// Native account-owned podcast subscriptions and listened evidence.
pub mod podcast_store;
mod private_storage;

/// Account-private retained Wikipedia articles.
pub mod article_store;
mod private_documents;

#[cfg(test)]
#[path = "podcast_store_test_support.rs"]
mod private_store_test_support;
