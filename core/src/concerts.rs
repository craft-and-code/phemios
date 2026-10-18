//! Explicit JamBase v3 reads with native credentials and durable, fail-closed admission.
use serde_json::Value;
use std::time::{Duration, Instant};
use ureq::unversioned::transport::DefaultConnector;
#[path = "concerts_budget.rs"]
mod budget;
#[path = "concerts_projection.rs"]
mod projection;
pub use budget::Budget;
const INVALID: &str = "Réponse JamBase invalide.";
/// Validate header-safe provider credentials without returning secrets in errors.
pub fn validate_key(key: &str) -> Result<(), String> {
    if !(16..=256).contains(&key.len())
        || !key
            .bytes()
            .all(|v| v.is_ascii_alphanumeric() || b"_-".contains(&v))
    {
        return Err("Clé JamBase invalide.".into());
    }
    Ok(())
}
fn validate_query(key: &str, artist: &str, page: u32) -> Result<(), String> {
    validate_key(key)?;
    if artist.is_empty()
        || artist.len() > 200
        || artist.chars().any(char::is_control)
        || artist.contains('|')
        || page >= 10
    {
        return Err("Recherche de concerts invalide.".into());
    }
    Ok(())
}
/// Fixed HTTPS host, no redirects, bounded responses and at most one HTTP request per second.
pub struct Directory {
    agent: ureq::Agent,
    last: Option<Instant>,
}
impl Default for Directory {
    fn default() -> Self {
        let config = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(15)))
            .max_redirects(0)
            .proxy(None)
            .build();
        Self {
            agent: ureq::Agent::with_parts(
                config,
                DefaultConnector::default(),
                crate::podcast::PublicResolver,
            ),
            last: None,
        }
    }
}
impl Directory {
    fn request(
        &mut self,
        key: &str,
        endpoint: &str,
        artist: &str,
        page: u32,
    ) -> Result<Value, String> {
        if let Some(last) = self.last {
            std::thread::sleep(Duration::from_secs(1).saturating_sub(last.elapsed()));
        }
        self.last = Some(Instant::now());
        let mut request = self
            .agent
            .get(endpoint)
            .header("Authorization", format!("Bearer {key}"))
            .header("Accept", "application/json")
            .header(
                "User-Agent",
                "Phemios/0.1.0 (https://github.com/craft-and-code/phemios)",
            );
        request
            .headers_mut()
            .and_then(|headers| headers.get_mut("Authorization"))
            .ok_or("Clé JamBase invalide.")?
            .set_sensitive(true);
        if !artist.is_empty() {
            request = request
                .query("artistName", artist)
                .query("perPage", "100")
                .query("page", (page + 1).to_string())
                .query("sort", "eventDate");
        }
        let mut response = request.call().map_err(|error| match error {
            ureq::Error::StatusCode(401 | 403) => "Clé JamBase refusée.",
            ureq::Error::StatusCode(429) => "Limite JamBase atteinte. Réessayez plus tard.",
            _ => "JamBase indisponible. Réessayez plus tard.",
        })?;
        let body = response
            .body_mut()
            .with_config()
            .limit(2 * 1024 * 1024)
            .read_to_vec()
            .map_err(|_| "Réponse JamBase trop grande ou interrompue.")?;
        serde_json::from_slice(&body).map_err(|_| INVALID.into())
    }
    /// Check the unmetered shared subscription quota, then charge locally before the event request.
    /// No retries: each explicit attempt, including a failed HTTP read, consumes one local slot.
    pub fn events(
        &mut self,
        key: &str,
        artist: &str,
        page: u32,
        budget: &mut Budget,
    ) -> Result<Value, String> {
        guarded_events(key, artist, page, budget, |endpoint, artist, page| {
            self.request(key, endpoint, artist, page)
        })
    }
}
fn guarded_events(
    key: &str,
    artist: &str,
    page: u32,
    budget: &mut Budget,
    mut request: impl FnMut(&str, &str, u32) -> Result<Value, String>,
) -> Result<Value, String> {
    let artist = artist.trim();
    validate_query(key, artist, page)?;
    if budget.status()["remaining"] == 0 {
        return Err(budget::EXHAUSTED.into());
    }
    let quota = request("https://api.data.jambase.com/v3/quota", "", 0)?;
    quota_allows(&quota)?;
    budget.reconcile(&quota)?;
    budget.reserve()?;
    let value = request("https://api.data.jambase.com/v3/events", artist, page)?;
    projection::project(&value, artist, page)
}

fn quota_allows(value: &Value) -> Result<(), String> {
    let used = value["usedCalls"]
        .as_u64()
        .ok_or("Quota JamBase indisponible. Aucune recherche envoyée.")?;
    let remaining = value["remainingCalls"]
        .as_u64()
        .ok_or("Quota JamBase indisponible. Aucune recherche envoyée.")?;
    let quota = value["quota"].as_u64().ok_or(INVALID)?;
    if used >= 1000 || remaining == 0 || used >= quota {
        return Err(budget::EXHAUSTED.into());
    }
    if remaining > quota.saturating_sub(used) {
        return Err(INVALID.into());
    }
    if value["overageCalls"].as_u64() != Some(0) || value["noMonthlyCap"] != false {
        return Err(INVALID.into());
    }
    Ok(())
}
#[cfg(test)]
#[path = "concerts_tests.rs"]
mod tests;
