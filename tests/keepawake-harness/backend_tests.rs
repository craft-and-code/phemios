use super::{
    fixtures::{options, Fixture},
    linux, Options,
};
use std::{
    sync::atomic::Ordering,
    time::{Duration, Instant},
};

#[test]
fn display_idle_arguments_cookie_and_fd_lifetime_are_preserved() {
    let fixture = Fixture::new();
    let guard = linux::KeepAwake::new(options()).unwrap();
    assert_eq!(
        fixture.events(),
        [
            "display:org.example.fixture:Fixture playback",
            "system:idle:Fixture player:Fixture playback:block"
        ]
    );
    assert_eq!(fixture.state.peers.lock().unwrap().len(), 1);
    fixture.assert_fds(false);
    // An idle caller must not stop the runtime which owns the connections.
    std::thread::sleep(Duration::from_millis(40));
    fixture.assert_fds(false);
    fixture.assert_clients_alive();
    drop(guard);
    assert_eq!(fixture.events().last().unwrap(), "release:42");
    fixture.assert_fds(true);
    fixture.assert_clients_closed();
}

#[test]
fn disabled_options_acquire_no_cookie_or_descriptor() {
    let fixture = Fixture::new();
    drop(linux::KeepAwake::new(Options::default()).unwrap());
    assert!(fixture.events().is_empty());
}

#[test]
fn explicit_sleep_is_distinct_from_the_apps_idle_only_policy() {
    let fixture = Fixture::new();
    let mut opts = options();
    opts.display = false;
    opts.idle = false;
    opts.sleep = true;
    let guard = linux::KeepAwake::new(opts).unwrap();
    assert_eq!(
        fixture.events(),
        ["system:sleep:Fixture player:Fixture playback:block"]
    );
    fixture.assert_fds(false);
    drop(guard);
    fixture.assert_fds(true);
}

#[test]
fn failed_system_acquisition_rolls_back_the_display_cookie() {
    let fixture = Fixture::new();
    fixture.state.fail_idle.store(true, Ordering::SeqCst);
    assert!(linux::KeepAwake::new(options()).is_err());
    assert_eq!(fixture.events().last().unwrap(), "release:42");
    fixture.assert_clients_closed();
    fixture.state.fail_idle.store(false, Ordering::SeqCst);
    drop(linux::KeepAwake::new(options()).unwrap());
    fixture.assert_fds(true);
}

#[test]
fn refused_release_never_panics_and_releases_descriptors_and_connections() {
    let fixture = Fixture::new();
    let guard = linux::KeepAwake::new(options()).unwrap();
    fixture.state.fail_release.store(true, Ordering::SeqCst);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| drop(guard))).is_ok());
    fixture.assert_fds(true);
    fixture.assert_clients_closed();
    fixture.state.fail_release.store(false, Ordering::SeqCst);
    drop(linux::KeepAwake::new(options()).unwrap());
}

#[test]
fn slow_acquisition_is_bounded_and_closes_the_unknown_cookie_connection() {
    let fixture = Fixture::new();
    fixture.state.acquire_delay.store(2500, Ordering::SeqCst);
    let start = Instant::now();
    assert!(linux::KeepAwake::new(options()).is_err());
    assert!(start.elapsed() < Duration::from_secs(2));
    fixture.assert_clients_closed();
}

#[test]
fn slow_release_is_bounded_and_closes_the_client_and_descriptor() {
    let fixture = Fixture::new();
    let guard = linux::KeepAwake::new(options()).unwrap();
    fixture.state.release_delay.store(2500, Ordering::SeqCst);
    let start = Instant::now();
    drop(guard);
    assert!(start.elapsed() < Duration::from_millis(1500));
    fixture.assert_fds(true);
    fixture.assert_clients_closed();
}

#[test]
fn missing_service_refuses_acquisition_then_allows_retry() {
    let fixture = Fixture::new();
    fixture
        .runtime
        .block_on(fixture.session.release_name("org.freedesktop.ScreenSaver"))
        .unwrap();
    assert!(linux::KeepAwake::new(options()).is_err());
    fixture
        .runtime
        .block_on(fixture.session.request_name("org.freedesktop.ScreenSaver"))
        .unwrap();
    drop(linux::KeepAwake::new(options()).unwrap());
}

#[test]
fn disconnected_service_during_release_does_not_panic() {
    let fixture = Fixture::new();
    let guard = linux::KeepAwake::new(options()).unwrap();
    fixture
        .runtime
        .block_on(fixture.session.clone().close())
        .unwrap();
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| drop(guard))).is_ok());
    fixture.assert_fds(true);
}

#[test]
fn dropping_from_another_async_runtime_does_not_panic() {
    let fixture = Fixture::new();
    let guard = linux::KeepAwake::new(options()).unwrap();
    fixture.runtime.block_on(async {
        drop(guard);
    });
    fixture.assert_fds(true);
    fixture.assert_clients_closed();
}

#[test]
fn stalled_authentication_is_bounded_and_rolls_back_display() {
    // Run separately with a private Unix socket that never answers authentication.
    assert!(std::env::var_os("PHEMIOS_BLACKHOLE_BUS").is_some());
    let fixture = Fixture::new();
    let start = Instant::now();
    assert!(linux::KeepAwake::new(options()).is_err());
    assert!(start.elapsed() < Duration::from_secs(2));
    assert_eq!(fixture.events().last().unwrap(), "release:42");
    fixture.assert_clients_closed();
}

#[test]
fn both_system_locks_live_until_the_guard_is_released() {
    let fixture = Fixture::new();
    let mut opts = options();
    opts.sleep = true;
    let guard = linux::KeepAwake::new(opts).unwrap();
    assert_eq!(fixture.state.peers.lock().unwrap().len(), 2);
    assert!(fixture
        .events()
        .contains(&"system:sleep:Fixture player:Fixture playback:block".into()));
    fixture.assert_fds(false);
    drop(guard);
    fixture.assert_fds(true);
}

#[test]
fn failed_sleep_rolls_back_the_previously_acquired_idle_fd_and_cookie() {
    let fixture = Fixture::new();
    fixture.state.fail_sleep.store(true, Ordering::SeqCst);
    let mut opts = options();
    opts.sleep = true;
    assert!(linux::KeepAwake::new(opts).is_err());
    assert_eq!(fixture.state.peers.lock().unwrap().len(), 1);
    assert_eq!(fixture.events().last().unwrap(), "release:42");
    fixture.assert_fds(true);
    fixture.assert_clients_closed();
}

#[test]
fn synchronous_creation_from_another_async_runtime_does_not_panic() {
    let fixture = Fixture::new();
    fixture.runtime.block_on(async {
        drop(linux::KeepAwake::new(options()).unwrap());
    });
    fixture.assert_fds(true);
    fixture.assert_clients_closed();
}
