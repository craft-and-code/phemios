//! Provider-only authority, response shape and retry-deadline policies.
use serde_json::Value;
use std::time::Duration;
/// A whole command shares this budget across discovery and mirror attempts.
const OPERATION_TIMEOUT: Duration = Duration::from_secs(24);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(8);
/// Bootstrap names are the provider's aggregate DNS name and its documented HTTPS example.
pub(super) const BOOTSTRAPS: [&str; 2] = [
    "https://all.api.radio-browser.info",
    "https://de1.api.radio-browser.info",
];
pub(super) fn request_timeout(elapsed: Duration) -> Result<Duration, String> {
    OPERATION_TIMEOUT
        .checked_sub(elapsed)
        .filter(|remaining| !remaining.is_zero())
        .map(|remaining| remaining.min(REQUEST_TIMEOUT))
        .ok_or_else(|| "La connexion à Radio Browser a expiré. Réessayez.".into())
}
/// Classify known local/status failures without echoing provider bodies or transport internals.
pub(super) fn request_failure(error: ureq::Error) -> String {
    match error {
        ureq::Error::StatusCode(503) => {
            "Radio Browser est temporairement indisponible (HTTP 503). Réessayez plus tard."
        }
        ureq::Error::StatusCode(429) => {
            "Radio Browser limite les requêtes (HTTP 429). Réessayez plus tard."
        }
        ureq::Error::StatusCode(500..=599) => {
            "Le serveur Radio Browser rencontre une erreur interne. Réessayez plus tard."
        }
        ureq::Error::StatusCode(_) => "Radio Browser a refusé la requête.",
        ureq::Error::HostNotFound => {
            "Le serveur Radio Browser est introuvable. Vérifiez votre connexion Internet."
        }
        ureq::Error::Timeout(_) => "La connexion à Radio Browser a expiré. Réessayez.",
        ureq::Error::Io(error)
            if matches!(
                error.kind(),
                std::io::ErrorKind::ConnectionReset
                    | std::io::ErrorKind::BrokenPipe
                    | std::io::ErrorKind::UnexpectedEof
            ) =>
        {
            "Radio Browser a interrompu la connexion. Réessayez plus tard."
        }
        ureq::Error::Tls(_) | ureq::Error::Rustls(_) | ureq::Error::TlsRequired => {
            "La connexion sécurisée à Radio Browser a échoué."
        }
        _ => "La connexion à Radio Browser a échoué. Vérifiez votre connexion Internet.",
    }
    .into()
}
/// Try distinct discovery authorities, rejecting malformed lists before committing mirror state.
pub(super) fn discover_mirrors(
    mut read: impl FnMut(&str) -> Result<Value, String>,
) -> Result<Vec<String>, String> {
    let mut failure = "Radio Browser indisponible. Réessayez.".to_owned();
    for host in BOOTSTRAPS {
        match read(host).and_then(|value| mirror_hosts(&value)) {
            Ok(hosts) => return Ok(hosts),
            Err(error) => failure = error,
        }
    }
    Err(failure)
}
pub(super) fn mirror_hosts(value: &Value) -> Result<Vec<String>, String> {
    let rows = value
        .as_array()
        .filter(|rows| !rows.is_empty() && rows.len() <= 64)
        .ok_or("Liste des serveurs Radio Browser invalide.")?;
    let mut hosts = Vec::new();
    for row in rows {
        let host = row["name"]
            .as_str()
            .ok_or("Serveur Radio Browser invalide.")?;
        let label = host
            .strip_suffix(".api.radio-browser.info")
            .ok_or("Serveur Radio Browser non autorisé.")?;
        if label.is_empty()
            || label.len() > 63
            || !label
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-')
            || label.starts_with('-')
            || label.ends_with('-')
        {
            return Err("Serveur Radio Browser non autorisé.".into());
        }
        let url = format!("https://{host}");
        if !hosts.contains(&url) {
            hosts.push(url);
        }
    }
    Ok(hosts)
}
pub(super) fn valid_uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(i, b)| {
            if [8, 13, 18, 23].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
}
// This retired RMC endpoint still appears in the directory; preserve the broadcast identity.
pub(super) fn preferred_stream(url: &str) -> &str {
    if url.split('?').next() == Some("https://audio.bfmtv.com/rmcradio_128.mp3") {
        "https://hls-rmc.nextradiotv.com/no_ssai/128k/media.m3u8"
    } else {
        url
    }
}
pub(super) fn country_filter(country: &str) -> (&'static str, String) {
    let country = country.trim();
    if country.len() == 2 && country.bytes().all(|value| value.is_ascii_alphabetic()) {
        ("countrycode", country.to_ascii_uppercase())
    } else {
        ("country", country.to_owned())
    }
}
pub(super) fn retry_mirrors(
    hosts: &[String],
    retry_empty: bool,
    mut read: impl FnMut(&str) -> Result<Value, String>,
) -> Result<Value, String> {
    let mut empty = None;
    let mut failure = "Radio Browser indisponible. Réessayez.".to_owned();
    for host in hosts.iter().take(3) {
        match read(host) {
            Ok(value) if retry_empty && value.as_array().is_some_and(Vec::is_empty) => {
                empty = Some(value)
            }
            Ok(value) => return Ok(value),
            Err(error) => failure = error,
        }
    }
    empty.ok_or(failure)
}

/// Only complete bounded station pages may stop mirror failover.
pub(super) fn station_page(value: Value) -> Result<Value, String> {
    let rows = value
        .as_array()
        .filter(|rows| rows.len() <= 51)
        .ok_or("Page Radio Browser invalide.")?;
    for row in rows {
        if !row["stationuuid"].as_str().is_some_and(valid_uuid)
            || !row["bitrate"]
                .as_u64()
                .is_some_and(|rate| rate <= 9_007_199_254_740_991)
            || ["name", "country", "tags", "codec"]
                .iter()
                .any(|key| !row[*key].as_str().is_some_and(|text| text.len() <= 4096))
        {
            return Err("Station Radio Browser invalide.".into());
        }
    }
    Ok(value)
}
pub(super) fn station_statistics(value: Value) -> Result<Value, String> {
    if !value["stations"]
        .as_u64()
        .is_some_and(|count| count <= 9_007_199_254_740_991)
    {
        return Err("Statistiques Radio Browser invalides.".into());
    }
    Ok(value)
}
pub(super) fn resolved_station(value: Value, uuid: &str) -> Result<Value, String> {
    if !(value["ok"] == true || value["ok"] == "true")
        || value["stationuuid"] != uuid
        || !value["url"].as_str().is_some_and(|url| {
            !url.is_empty() && url.len() <= 8192 && !url.chars().any(char::is_control)
        })
    {
        return Err("Le flux de cette station est indisponible.".into());
    }
    Ok(value)
}
#[cfg(test)]
#[path = "policy_tests.rs"]
mod tests;
