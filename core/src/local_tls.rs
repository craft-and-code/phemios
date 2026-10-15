//! Per-child loopback certificate, exchanged through stdin rather than files or arguments.
use serde_json::{Value, json};
pub(super) struct Identity {
    pub(super) certificate_der: Vec<u8>,
    certificate_pem: String,
    private_key_pem: String,
}
impl Identity {
    pub(super) fn generate() -> Result<Self, String> {
        let rcgen::CertifiedKey { cert, signing_key } =
            rcgen::generate_simple_self_signed(vec!["127.0.0.1".into()])
                .map_err(|_| "Création de l’identité TLS locale impossible.")?;
        Ok(Self {
            certificate_der: cert.der().to_vec(),
            certificate_pem: cert.pem(),
            private_key_pem: signing_key.serialize_pem(),
        })
    }
    pub(super) fn bootstrap(&self, username: &str, password: &str) -> Value {
        json!({"username":username,"password":password,"tls":{"certificate":self.certificate_pem,"private_key":self.private_key_pem}})
    }
}
pub(super) fn address(value: &Value) -> Option<String> {
    if value["desktopProtocol"] != 2 {
        return None;
    }
    let address = crate::network::server_address(value["address"].as_str()?).ok()?;
    let uri: ureq::http::Uri = address.parse().ok()?;
    (uri.scheme_str() == Some("https")
        && uri.host() == Some("127.0.0.1")
        && uri.port_u16().is_some_and(|port| port > 0))
    .then_some(address)
}
#[cfg(test)]
#[path = "local_tls_tests.rs"]
mod tests;
