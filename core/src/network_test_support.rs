//! Test-only authenticated client for isolated loopback transports.
pub(crate) fn client(server: String) -> super::Client {
    super::Client {
        agent: super::agent(),
        server,
        token: "fictional".into(),
        account: serde_json::json!({"account":{"role":"user"}}),
    }
}
