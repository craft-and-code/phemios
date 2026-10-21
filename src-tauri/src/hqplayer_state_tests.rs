use super::test_support::Endpoint;
use super::*;

#[test]
fn delayed_disconnect_cannot_close_a_replacement_connection() {
    let state = HqPlayer::default();
    let first = Endpoint::new("old");
    state
        .connect(state.reserve(), "127.0.0.1", first.port, json!([]))
        .expect("first connection");
    let disconnecting = state.reserve();
    let replacement = Endpoint::new("replacement");
    state
        .connect(state.reserve(), "127.0.0.1", replacement.port, json!([]))
        .expect("replacement connection");
    let result = state.disconnect(disconnecting);
    assert!(
        state.controller.connected(),
        "old disconnect closed replacement endpoint"
    );
    assert!(result.is_err());
    assert_eq!(replacement.connections.load(Ordering::SeqCst), 1);
}

#[test]
fn delayed_connect_cannot_reopen_an_endpoint_after_disconnect() {
    let state = HqPlayer::default();
    let old = Endpoint::new("old");
    let connecting = state.reserve();
    state.disconnect(state.reserve()).expect("new disconnect");
    let result = state.connect(connecting, "127.0.0.1", old.port, json!([]));
    assert!(
        !state.controller.connected(),
        "cancelled connect reopened endpoint"
    );
    assert!(result.is_err());
    assert_eq!(old.connections.load(Ordering::SeqCst), 0);
}

#[test]
fn pending_configuration_retires_the_captured_folder_mapping() {
    let state = HqPlayer::default();
    let first = Endpoint::new("old");
    let mappings = json!([{"from":"/music", "to":"/old-share"}]);
    state
        .connect(state.reserve(), "127.0.0.1", first.port, mappings.clone())
        .expect("first connection");
    let (held, captured) = state.profile().expect("stable profile");
    assert_eq!(captured, mappings);
    let next = state.reserve();
    assert!(!state.profile_current(held));
    assert!(
        state.profile().is_err(),
        "pending endpoint cannot inherit the old mapping"
    );
    let second = Endpoint::new("new");
    let mappings = json!([{"from":"/music", "to":"/new-share"}]);
    state
        .connect(next, "127.0.0.1", second.port, mappings.clone())
        .expect("new connection");
    let (current, value) = state.profile().expect("new profile");
    assert_eq!(current, next);
    assert_eq!(value, mappings);
    assert!(!state.profile_current(held));
    let returning = state.reserve();
    state
        .connect(returning, "127.0.0.1", first.port, captured.clone())
        .expect("return to original endpoint");
    assert_eq!(state.profile().expect("returning profile").1, captured);
    assert!(
        !state.profile_current(held),
        "identical endpoint/mapping revived an old preparation"
    );
}

#[test]
fn superseded_inflight_probe_cannot_acknowledge_a_current_profile() {
    let state = HqPlayer::default();
    let endpoint = Endpoint::stalled("delayed");
    let connecting = state.reserve();
    let pending = state.clone();
    let port = endpoint.port;
    let worker =
        std::thread::spawn(move || pending.connect(connecting, "127.0.0.1", port, json!([])));
    endpoint.wait_until_queried();
    let stopping = state.reserve();
    endpoint.resume_reply();
    assert!(
        worker.join().expect("probe worker").is_err(),
        "retired connection acknowledged success"
    );
    assert!(state.profile().is_err());
    state.disconnect(stopping).expect("current disconnect");
    assert!(!state.controller.connected());
}

#[test]
fn failed_connection_does_not_publish_a_profile_and_explicit_retry_recovers() {
    let state = HqPlayer::default();
    let endpoint = Endpoint::new("recoverable");
    assert!(
        state
            .connect(state.reserve(), "127.0.0.1", 0, json!([]))
            .is_err()
    );
    assert!(state.profile().is_err());
    let ticket = state.reserve();
    state
        .connect(ticket, "127.0.0.1", endpoint.port, json!([]))
        .expect("explicit retry");
    assert_eq!(state.profile().expect("recovered profile").0, ticket);
}

#[test]
fn profile_change_while_retiring_output_prevents_activation_with_the_old_mapping() {
    use std::cell::Cell;
    let state = HqPlayer::default();
    let endpoint = Endpoint::new("original");
    state
        .connect(
            state.reserve(),
            "127.0.0.1",
            endpoint.port,
            json!([{ "from": "/music", "to": "/share" }]),
        )
        .expect("connection");
    let (profile, _) = state.profile().expect("captured profile");
    let started = Cell::new(false);
    let _routing = state.routing.lock().expect("routing");
    let result = crate::playback_routing::replace(
        &state.published_epoch,
        1,
        || {
            if state.profile_current(profile) {
                Ok(())
            } else {
                Err("profile changed".into())
            }
        },
        || {
            state.reserve();
            Ok(())
        },
        || {
            started.set(true);
            Ok(())
        },
    );
    assert!(result.is_err());
    assert!(!started.get());
    assert_eq!(state.published_epoch.load(Ordering::SeqCst), 0);
}

#[test]
fn logout_of_the_other_source_does_not_cancel_a_pending_audio_start() {
    use phemios_core::federation::Source;
    for (retired_source, next_source) in [
        (Source::Server, Source::Local),
        (Source::Local, Source::Server),
    ] {
        let state = HqPlayer::default();
        let (pending_client, retiring_client) = crate::account_test_support::sessions();
        let pending_owner = Mutex::new(Some(pending_client.clone()));
        let pending_identity = std::sync::atomic::AtomicU64::new(1);
        let retiring_owner = Mutex::new(Some(retiring_client));
        let retiring_identity = std::sync::atomic::AtomicU64::new(1);
        let source = Mutex::new(retired_source);
        let pending = state.reserve_transport();
        let retiring = state.reserve_cleanup();
        crate::sessions::invalidate(&retiring_owner, &retiring_identity).expect("source logout");
        let accepted = crate::playback_routing::replace(
            &state.published_epoch,
            pending,
            || {
                crate::sessions::with_current(
                    &pending_owner,
                    &pending_identity,
                    "1",
                    &pending_client,
                    || {
                        if state.transport_current(pending) {
                            Ok(())
                        } else {
                            Err("unrelated logout cancelled preparation".into())
                        }
                    },
                )
            },
            || Ok(()),
            || crate::playback_routing::with_source(&source, next_source, || Ok(())),
        );
        assert!(accepted.is_ok(), "{retired_source:?} logout: {accepted:?}");
        let halted = std::cell::Cell::new(false);
        crate::playback_routing::retire(&state.routing, &state.published_epoch, retiring, || {
            if *source.lock().expect("source") == retired_source {
                halted.set(true);
            }
            Ok(())
        })
        .expect("source cleanup");
        assert!(
            !halted.get(),
            "{retired_source:?} cleanup halted {next_source:?}"
        );
    }
}

#[test]
fn source_logout_still_refuses_its_own_pending_start() {
    let state = HqPlayer::default();
    let (client, _) = crate::account_test_support::sessions();
    let owner = Mutex::new(Some(client.clone()));
    let identity = std::sync::atomic::AtomicU64::new(1);
    let pending = state.reserve_transport();
    state.reserve_cleanup();
    crate::sessions::invalidate(&owner, &identity).expect("owner logout");
    assert!(
        state.transport_current(pending),
        "source cleanup must rely on exact session admission"
    );
    let started = std::cell::Cell::new(false);
    let result = crate::playback_routing::replace(
        &state.published_epoch,
        pending,
        || crate::sessions::with_current(&owner, &identity, "1", &client, || Ok(())),
        || Ok(()),
        || {
            started.set(true);
            Ok(())
        },
    );
    assert!(result.is_err());
    assert!(!started.get());
}

#[test]
fn endpoint_disconnect_retires_hqplayer_profile_without_cancelling_local_preparation() {
    let state = HqPlayer::default();
    let endpoint = Endpoint::new("optional");
    state
        .connect(state.reserve(), "127.0.0.1", endpoint.port, json!([]))
        .expect("HQPlayer connection");
    let (profile, _) = state.profile().expect("captured HQPlayer profile");
    let local = state.reserve_transport();
    let disconnecting = state.begin_disconnect();
    assert!(!state.profile_current(profile));
    state
        .disconnect(disconnecting)
        .expect("HQPlayer disconnect");
    assert!(
        state.transport_current(local),
        "disconnecting an optional endpoint cancelled local audio preparation"
    );
    assert!(!state.controller.connected());
}

#[test]
fn replacement_start_keeps_cleanup_order_and_retires_older_transport_intent() {
    let state = HqPlayer::default();
    let old = state.reserve_transport();
    let logout = state.reserve_cleanup();
    let replacement = state.reserve_transport();
    assert!(old < logout && logout < replacement);
    assert!(!state.transport_current(old));
    assert!(state.transport_current(replacement));
    crate::playback_routing::publish(&state.published_epoch, replacement, || Ok(()))
        .expect("replacement output");
    crate::playback_routing::retire(&state.routing, &state.published_epoch, logout, || {
        panic!("old logout reached the accepted successor")
    })
    .expect("retired cleanup");
}

#[test]
fn queued_hqplayer_start_cannot_adopt_a_reconfigured_endpoint() {
    for disconnect_first in [false, true] {
        let state = HqPlayer::default();
        let original = Endpoint::new("original");
        state
            .connect(state.reserve(), "127.0.0.1", original.port, json!([]))
            .expect("original endpoint");
        let captured = state.capture_profile();
        let pending = state.reserve_transport();
        if disconnect_first {
            let disconnecting = state.begin_disconnect();
            state.disconnect(disconnecting).expect("disconnect");
        }
        let replacement = Endpoint::new("replacement");
        state
            .connect(state.reserve(), "127.0.0.1", replacement.port, json!([]))
            .expect("replacement endpoint");
        assert!(
            state.transport_current(pending),
            "endpoint configuration must not cancel local transport intent"
        );
        assert!(
            state.profile_at(captured).is_err(),
            "queued HQPlayer start adopted a later endpoint (disconnect_first={disconnect_first})"
        );
        assert!(state.profile_at(state.capture_profile()).is_ok());
        assert_eq!(replacement.connections.load(Ordering::SeqCst), 1);
    }
}
