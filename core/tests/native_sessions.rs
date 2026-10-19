//! Exercise the actual framework-independent native session module without compiling Tauri.
#[path = "../../src-tauri/src/account_test_support.rs"]
mod account_test_support;
// Native entry points not called by the included unit suite remain compiled here.
#[allow(dead_code)]
#[path = "../../src-tauri/src/sessions.rs"]
mod sessions;
