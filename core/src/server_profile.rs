//! Explicitly imported public identity for a separate Aède HTTPS loopback application.
use serde_json::Value;
/// Parse a bounded public connection profile. Private material and remote trust overrides are refused.
pub fn parse(text: &str) -> Result<Value, String> {
    if text.len() > 32768 {
        return Err("Profil de connexion trop volumineux.".into());
    }
    let value: Value =
        serde_json::from_str(text).map_err(|_| "Profil de connexion Aède illisible.")?;
    let fields = value
        .as_object()
        .ok_or("Profil de connexion Aède invalide.")?;
    if fields.len() != 5
        || fields.keys().any(|key| {
            !["format", "version", "address", "username", "certificate"].contains(&key.as_str())
        })
        || value["format"] != "aede-local-server"
        || value["version"] != 1
    {
        return Err("Profil de connexion Aède incompatible ou contenant des champs privés.".into());
    }
    let address =
        crate::network::server_address(value["address"].as_str().ok_or("Adresse absente.")?)?;
    let uri: ureq::http::Uri = address.parse().map_err(|_| "Adresse locale invalide.")?;
    if uri.scheme_str() != Some("https")
        || uri.host() != Some("127.0.0.1")
        || uri.port_u16().is_none_or(|port| port == 0)
    {
        return Err("Ce certificat est réservé à un serveur HTTPS sur cet ordinateur.".into());
    }
    let username = value["username"].as_str().ok_or("Compte absent.")?;
    if username.is_empty()
        || username.len() > 128
        || !username
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
    {
        return Err("Compte du profil invalide.".into());
    }
    let bytes = value["certificate"]
        .as_array()
        .filter(|v| !v.is_empty() && v.len() <= 8192)
        .ok_or("Certificat local invalide.")?
        .iter()
        .map(|v| {
            v.as_u64()
                .and_then(|n| u8::try_from(n).ok())
                .ok_or("Certificat local invalide.")
        })
        .collect::<Result<Vec<_>, _>>()?;
    rustls::RootCertStore::empty()
        .add(rustls::pki_types::CertificateDer::from(bytes))
        .map_err(|_| "Certificat local illisible.")?;
    Ok(value)
}
#[cfg(test)]
#[path = "server_profile_tests.rs"]
mod tests;
