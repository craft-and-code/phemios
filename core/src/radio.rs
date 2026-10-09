//! Explicit Radio Browser directory access, separate from Aède credentials and catalog truth.
use serde_json::{Value, json};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
const BOOTSTRAP: &str = "https://all.api.radio-browser.info";
const LIMIT: u64 = 1024 * 1024;

/// A bounded directory client; construction and offline navigation perform no network requests.
pub struct Directory {
    agent: ureq::Agent,
    mirrors: Vec<String>,
    discovered: Option<Instant>,
    next: usize,
}
impl Default for Directory {
    fn default() -> Self {
        Self {
            agent: ureq::Agent::config_builder()
                .timeout_global(Some(Duration::from_secs(12)))
                .max_redirects(0)
                .build()
                .into(),
            mirrors: Vec::new(),
            discovered: None,
            next: 0,
        }
    }
}
fn mirror_hosts(value: &Value) -> Result<Vec<String>, String> {
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
fn valid_uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(i, b)| {
            if [8, 13, 18, 23].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
}
impl Directory {
    fn read(&self, host: &str, path: &str, query: &[(&str, &str)]) -> Result<Value, String> {
        let mut request = self
            .agent
            .get(format!("{host}{path}"))
            .header("User-Agent", "Phemios/0.1.0 (Radio Browser desktop client)")
            .header("Accept", "application/json");
        for (key, value) in query {
            request = request.query(key, value);
        }
        let mut response = request
            .call()
            .map_err(|_| "Radio Browser indisponible. Réessayez.")?;
        let bytes = response
            .body_mut()
            .with_config()
            .limit(LIMIT)
            .read_to_vec()
            .map_err(|_| "Réponse Radio Browser trop grande ou interrompue.")?;
        serde_json::from_slice(&bytes).map_err(|_| "Réponse Radio Browser invalide.".into())
    }
    fn mirror(&mut self) -> Result<String, String> {
        if self
            .discovered
            .is_none_or(|time| time.elapsed() >= Duration::from_secs(600))
        {
            // std supports forward DNS but not portable PTR lookup; use the documented server-list fallback.
            self.mirrors = mirror_hosts(&self.read(BOOTSTRAP, "/json/servers", &[])?)?;
            self.discovered = Some(Instant::now());
            self.next = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_or(0, |d| d.subsec_nanos() as usize)
                % self.mirrors.len();
        }
        let host = self
            .mirrors
            .get(self.next % self.mirrors.len())
            .cloned()
            .ok_or("Aucun serveur Radio Browser disponible.")?;
        self.next = self.next.wrapping_add(1);
        Ok(host)
    }
    /// Search the complete external directory with at most 51 rows and an explicit page window.
    pub fn search(
        &mut self,
        name: &str,
        country: &str,
        tag: &str,
        offset: u32,
        secure_only: bool,
    ) -> Result<Value, String> {
        if [name, country, tag]
            .iter()
            .any(|s| s.len() > 256 || s.chars().any(char::is_control))
            || offset > 1_000_000
        {
            return Err("Recherche radio invalide ou trop longue.".into());
        }
        let host = self.mirror()?;
        let offset = offset.to_string();
        let mut query = vec![
            ("name", name.trim()),
            ("country", country.trim()),
            ("tag", tag.trim()),
            ("offset", &offset),
            ("limit", "51"),
            ("hidebroken", "true"),
            ("order", "clickcount"),
            ("reverse", "true"),
        ];
        if secure_only {
            query.push(("is_https", "true"));
        }
        let stations = self.read(&host, "/json/stations/search", &query)?;
        if !stations.as_array().is_some_and(|rows| rows.len() <= 51) {
            return Err("Page Radio Browser invalide.".into());
        }
        Ok(stations)
    }
    /// Read external directory counts only after an explicit user request.
    pub fn statistics(&mut self) -> Result<Value, String> {
        let host = self.mirror()?;
        self.read(&host, "/json/stats", &[])
    }
    /// Resolve one station and record its requested start using the provider's documented click endpoint.
    pub fn resolve(&mut self, uuid: &str) -> Result<Value, String> {
        if !valid_uuid(uuid) {
            return Err("Identifiant radio invalide.".into());
        }
        let host = self.mirror()?;
        let answer = self.read(&host, &format!("/json/url/{uuid}"), &[])?;
        if !(answer["ok"] == true || answer["ok"] == "true")
            || answer["stationuuid"] != uuid
            || answer["url"].as_str().is_none()
        {
            return Err("Le flux de cette station est indisponible.".into());
        }
        Ok(json!({"stationuuid": uuid, "url": answer["url"]}))
    }
}
#[cfg(test)]
#[path = "radio_tests.rs"]
mod tests;
