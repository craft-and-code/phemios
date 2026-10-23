//! Test-only public-API regressions for the reviewed GLib backport.
//! GLib is a Linux-only dev dependency; the optional host check imports the same tests.
#[cfg(all(test, target_os = "linux"))]
#[path = "variant_tests.rs"]
mod tests;
