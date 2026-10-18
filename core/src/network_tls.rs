//! Certificate trust for owned or explicitly imported loopback servers; never a global TLS bypass.
use super::Client;
use std::sync::Arc;

impl Client {
    /// Authenticate a trusted, explicitly imported or process-owned loopback identity.
    /// The exact supplied certificate is the sole HTTPS/WSS trust root; remote overrides are refused.
    pub fn login_pinned(
        server: &str,
        username: &str,
        password: &str,
        certificate: &[u8],
    ) -> Result<Self, String> {
        let server = super::server_address(server)?;
        let uri: ureq::http::Uri = server.parse().map_err(|_| "Adresse locale TLS invalide.")?;
        if uri.scheme_str() != Some("https")
            || uri.host() != Some("127.0.0.1")
            || uri.port_u16().is_none_or(|port| port == 0)
            || certificate.len() > 8192
        {
            return Err("L’identité TLS embarquée est réservée à la boucle locale.".into());
        }
        let certificate = rustls::pki_types::CertificateDer::from(certificate.to_vec());
        let mut roots = rustls::RootCertStore::empty();
        roots
            .add(certificate.clone())
            .map_err(|_| "Certificat du moteur local invalide.")?;
        let tls = rustls::ClientConfig::builder()
            .with_root_certificates(roots)
            .with_no_client_auth();
        let trusted = ureq::tls::Certificate::from_der(certificate.as_ref()).to_owned();
        let agent = ureq::Agent::config_builder()
            .timeout_global(Some(std::time::Duration::from_secs(30)))
            .max_redirects(0)
            .http_status_as_error(false)
            .tls_config(
                ureq::tls::TlsConfig::builder()
                    .root_certs([trusted].into())
                    .build(),
            )
            .build()
            .into();
        Self::authenticate(&server, username, password, agent, Some(Arc::new(tls)))
    }
}

#[cfg(test)]
#[path = "network_tls_tests.rs"]
mod tests;
