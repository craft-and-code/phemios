//! Explicit Radio Browser directory access, separate from Aède credentials and catalog truth.
use crate::podcast::PublicResolver;
use serde_json::{Value, json};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use ureq::unversioned::transport::DefaultConnector;
mod policy;
use policy::*;
const LIMIT: u64 = 1024 * 1024;

/// A bounded directory client independent of Aède sessions.
///
/// Construction is offline. Each command shares a 24-second discovery/retry budget,
/// accepts at most three validated mirrors, and refuses redirects, private DNS targets
/// and oversized bodies. External-service traffic never inherits proxy credentials.
#[derive(Clone)]
pub struct Directory {
    agent: ureq::Agent,
    mirrors: Vec<String>,
    discovered: Option<Instant>,
    next: usize,
}
impl Default for Directory {
    fn default() -> Self {
        let config = ureq::Agent::config_builder()
            .max_redirects(0)
            .proxy(None)
            .build();
        Self {
            agent: ureq::Agent::with_parts(config, DefaultConnector::default(), PublicResolver),
            mirrors: Vec::new(),
            discovered: None,
            next: 0,
        }
    }
}
impl Directory {
    fn read(
        &self,
        started: Instant,
        host: &str,
        path: &str,
        query: &[(&str, &str)],
    ) -> Result<Value, String> {
        let mut request = self
            .agent
            .get(format!("{host}{path}"))
            .config()
            .timeout_global(Some(request_timeout(started.elapsed())?))
            .build()
            .header("User-Agent", "Phemios/0.1.0 (Radio Browser desktop client)")
            .header("Accept", "application/json");
        for (key, value) in query {
            request = request.query(key, value);
        }
        let mut response = request.call().map_err(request_failure)?;
        let bytes = response
            .body_mut()
            .with_config()
            .limit(LIMIT)
            .read_to_vec()
            .map_err(|_| "Réponse Radio Browser trop grande ou interrompue.")?;
        serde_json::from_slice(&bytes).map_err(|_| "Réponse Radio Browser invalide.".into())
    }
    fn candidates(&mut self, started: Instant) -> Result<Vec<String>, String> {
        if self
            .discovered
            .is_none_or(|time| time.elapsed() >= Duration::from_secs(600))
        {
            // std supports forward DNS but not portable PTR lookup; use the documented server-list fallback.
            match discover_mirrors(|host| self.read(started, host, "/json/servers", &[])) {
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
        let mut hosts = Vec::with_capacity(self.mirrors.len().min(3));
        for _ in 0..self.mirrors.len().min(3) {
            hosts.push(self.mirrors[self.next % self.mirrors.len()].clone());
            self.next = self.next.wrapping_add(1);
        }
        if hosts.is_empty() {
            return Err("Aucun serveur Radio Browser disponible.".into());
        }
        Ok(hosts)
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
        let started = Instant::now();
        let hosts = self.candidates(started)?;
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
        let stations = retry_mirrors(
            &hosts,
            offset == "0"
                && name.trim().is_empty()
                && tag.trim().is_empty()
                && !country.trim().is_empty(),
            |host| {
                self.read(started, host, "/json/stations/search", &query)
                    .and_then(station_page)
            },
        )?;
        Ok(stations)
    }
    /// Read external directory counts only after an explicit user request.
    pub fn statistics(&mut self) -> Result<Value, String> {
        let started = Instant::now();
        let hosts = self.candidates(started)?;
        retry_mirrors(&hosts, false, |host| {
            self.read(started, host, "/json/stats", &[])
                .and_then(station_statistics)
        })
    }
    /// Resolve one station and record its requested start using the provider's documented click endpoint.
    pub fn resolve(&mut self, uuid: &str) -> Result<Value, String> {
        if !valid_uuid(uuid) {
            return Err("Identifiant radio invalide.".into());
        }
        let started = Instant::now();
        let hosts = self.candidates(started)?;
        let answer = retry_mirrors(&hosts, false, |host| {
            self.read(started, host, &format!("/json/url/{uuid}"), &[])
                .and_then(|value| resolved_station(value, uuid))
        })?;
        Ok(
            json!({"stationuuid": uuid, "url": preferred_stream(answer["url"].as_str().ok_or("Adresse du flux invalide.")?)}),
        )
    }
}
#[cfg(test)]
#[path = "radio_tests.rs"]
mod tests;
