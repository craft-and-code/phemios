use super::*;
#[test]
fn local_disc_snapshots_never_inherit_a_server_namespace() {
    let value = serde_json::json!({"source":"cd","reference":"track:cd/0000000000000001/7"});
    assert_eq!(
        public_snapshot(value.clone(), phemios_core::federation::Source::Server).unwrap(),
        value
    );
    assert_eq!(
        public_snapshot(value.clone(), phemios_core::federation::Source::Local).unwrap(),
        value
    );
}
