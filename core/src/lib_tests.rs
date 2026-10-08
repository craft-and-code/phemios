#[test]
fn current_clients_can_use_the_bridge() {
    assert!(super::validate_bridge(super::BRIDGE_VERSION).is_ok());
}

#[test]
fn unsupported_clients_are_refused() {
    assert!(super::validate_bridge(0).is_err());
    assert!(super::validate_bridge(super::BRIDGE_VERSION + 1).is_err());
}
