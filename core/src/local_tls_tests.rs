use super::*;
#[test]
fn owned_tls_requires_protocol_two_and_an_exact_ephemeral_loopback_https_authority() {
    assert_eq!(
        address(&json!({"desktopProtocol":2,"address":"https://127.0.0.1:1234"})).as_deref(),
        Some("https://127.0.0.1:1234")
    );
    for address_value in [
        "http://127.0.0.1:1234",
        "https://example.invalid:1234",
        "https://127.0.0.1:0",
        "https://127.0.0.1:1234/path",
        "https://user:secret@127.0.0.1:1234",
    ] {
        assert!(address(&json!({"desktopProtocol":2,"address":address_value})).is_none());
    }
    assert!(address(&json!({"desktopProtocol":1,"address":"http://127.0.0.1:1234"})).is_none());
}
#[test]
fn each_child_receives_a_distinct_memory_only_identity_through_its_bootstrap() {
    let first = Identity::generate().unwrap();
    let second = Identity::generate().unwrap();
    assert_ne!(first.certificate_der, second.certificate_der);
    let value = first.bootstrap("desktop-test", "fictional-passphrase");
    assert!(
        value["tls"]["certificate"]
            .as_str()
            .unwrap()
            .contains("BEGIN CERTIFICATE")
    );
    assert!(
        value["tls"]["private_key"]
            .as_str()
            .unwrap()
            .contains("BEGIN PRIVATE KEY")
    );
    assert!(value.to_string().len() < 32768);
}
