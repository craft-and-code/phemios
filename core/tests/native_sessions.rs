//! Exercise the actual framework-independent native session and snapshot modules without compiling Tauri.
#[path = "../../src-tauri/src/account_test_support.rs"]
mod account_test_support;
// Native entry points not called by the included unit suite remain compiled here.
#[allow(dead_code)]
#[path = "../../src-tauri/src/sessions.rs"]
mod sessions;

#[allow(dead_code)]
#[path = "../../src-tauri/src/snapshots.rs"]
mod snapshots;

#[allow(dead_code)]
#[path = "../../src-tauri/src/cd_accounts.rs"]
mod cd_accounts;

#[path = "../../src-tauri/src/playback_routing.rs"]
mod playback_routing;

#[path = "../../src-tauri/src/local_lifecycle.rs"]
mod local_lifecycle;

#[allow(dead_code)]
#[path = "../../src-tauri/src/hqplayer_state.rs"]
mod hqplayer_state;
