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
