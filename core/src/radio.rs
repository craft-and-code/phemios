//! Explicit Radio Browser directory access, separate from Aède credentials and catalog truth.
use serde_json::{Value, json};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
const BOOTSTRAP: &str = "https://all.api.radio-browser.info";
const LIMIT: u64 = 1024 * 1024;

/// A bounded directory client; construction and offline navigation perform no network requests.
#[derive(Clone)]
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
// This retired RMC endpoint still appears in the directory; preserve the broadcast identity.
fn preferred_stream(url: &str) -> &str {
    if url.split('?').next() == Some("https://audio.bfmtv.com/rmcradio_128.mp3") {
        "https://hls-rmc.nextradiotv.com/no_ssai/128k/media.m3u8"
    } else {
        url
    }
}
fn country_filter(country: &str) -> (&'static str, String) {
    let country = country.trim();
    if country.len() == 2 && country.bytes().all(|value| value.is_ascii_alphabetic()) {
        ("countrycode", country.to_ascii_uppercase())
    } else {
        ("country", country.to_owned())
    }
}
fn retry_mirrors(
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
            match retry_mirrors(&[BOOTSTRAP.into(), BOOTSTRAP.into()], false, |host| {
                self.read(host, "/json/servers", &[])
            })
            .and_then(|value| mirror_hosts(&value))
            {
                Ok(hosts) => {
                    self.mirrors = hosts;
                    self.discovered = Some(Instant::now());
                }
                Err(error) if self.mirrors.is_empty() => return Err(error),
                Err(_) => {} // Previously validated mirrors remain a usable fallback during bootstrap outages.
            }
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
        let (country_field, country_value) = country_filter(country);
        let mut query = vec![
            ("name", name.trim()),
            (country_field, country_value.as_str()),
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
        let mut hosts = vec![host];
        for _ in 1..self.mirrors.len().min(3) {
            hosts.push(self.mirror()?);
        }
        let stations = retry_mirrors(
            &hosts,
            offset == "0"
                && name.trim().is_empty()
                && tag.trim().is_empty()
                && !country.trim().is_empty(),
            |host| self.read(host, "/json/stations/search", &query),
        )?;
        if !stations.as_array().is_some_and(|rows| rows.len() <= 51) {
            return Err("Page Radio Browser invalide.".into());
        }
        Ok(stations)
    }
    /// Read external directory counts only after an explicit user request.
    pub fn statistics(&mut self) -> Result<Value, String> {
        let host = self.mirror()?;
        let mut hosts = vec![host];
        for _ in 1..self.mirrors.len().min(3) {
            hosts.push(self.mirror()?);
        }
        retry_mirrors(&hosts, false, |host| self.read(host, "/json/stats", &[]))
    }
    /// Resolve one station and record its requested start using the provider's documented click endpoint.
    pub fn resolve(&mut self, uuid: &str) -> Result<Value, String> {
        if !valid_uuid(uuid) {
            return Err("Identifiant radio invalide.".into());
        }
        let host = self.mirror()?;
        let mut hosts = vec![host];
        for _ in 1..self.mirrors.len().min(3) {
            hosts.push(self.mirror()?);
        }
        let answer = retry_mirrors(&hosts, false, |host| {
            self.read(host, &format!("/json/url/{uuid}"), &[])
        })?;
        if !(answer["ok"] == true || answer["ok"] == "true")
            || answer["stationuuid"] != uuid
            || answer["url"].as_str().is_none()
        {
            return Err("Le flux de cette station est indisponible.".into());
        }
        Ok(
            json!({"stationuuid": uuid, "url": preferred_stream(answer["url"].as_str().ok_or("Adresse du flux invalide.")?)}),
        )
    }
}
#[cfg(test)]
#[path = "radio_tests.rs"]
mod tests;
