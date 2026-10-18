use super::*;
fn profile() -> Value {
    let rcgen::CertifiedKey { cert, .. } =
        rcgen::generate_simple_self_signed(vec!["127.0.0.1".into()]).unwrap();
    serde_json::json!({"format":"aede-local-server","version":1,"address":"https://127.0.0.1:8787","username":"fictional","certificate":cert.der().to_vec()})
}
#[test]
fn imports_only_a_bounded_public_loopback_identity() {
    let value = profile();
    assert_eq!(parse(&value.to_string()).unwrap(), value);
}
#[test]
fn public_profile_never_accepts_private_material_or_remote_trust() {
    let value = profile();
    for address in [
        "http://127.0.0.1:8787",
        "https://remote.example:8787",
        "https://127.0.0.1:8787/path",
        "https://127.0.0.1",
    ] {
        let mut wrong = value.clone();
        wrong["address"] = address.into();
        assert!(parse(&wrong.to_string()).is_err());
    }
    let mut wrong = value;
    wrong["password"] = "must-not-be-imported".into();
    assert!(parse(&wrong.to_string()).is_err());
}
#[test]
fn rejects_invalid_certificate_schema_versions_and_oversize_before_authentication() {
    let value = profile();
    for certificate in [
        serde_json::json!([]),
        serde_json::json!([256]),
        serde_json::json!([-1]),
        serde_json::json!([1, 2, 3]),
    ] {
        let mut wrong = value.clone();
        wrong["certificate"] = certificate;
        assert!(parse(&wrong.to_string()).is_err());
    }
    let mut wrong = value;
    wrong["version"] = 2.into();
    assert!(parse(&wrong.to_string()).is_err());
    assert!(parse(&"x".repeat(32769)).is_err());
}
