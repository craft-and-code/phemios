//! Explicit fixed-host Ticketmaster Discovery reads, independent of Aède authentication.
use serde_json::{Value, json};
use std::{
    collections::BTreeSet,
    time::{Duration, Instant},
};
use ureq::unversioned::transport::DefaultConnector;
const INVALID: &str = "Réponse Ticketmaster invalide.";
fn normalized(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}
fn text(value: &Value) -> Option<&str> {
    value.as_str().filter(|v| {
        !v.is_empty() && v.len() <= 4096 && !v.chars().any(|c| c.is_control() && c != '\n')
    })
}
fn link(value: &Value) -> Option<&str> {
    text(value).filter(|v| crate::external_links::browser_url(v).is_ok())
}
/// Validate a provider key without ever including it in diagnostics or public projections.
pub fn validate_key(key: &str) -> Result<(), String> {
    if !(16..=128).contains(&key.len()) || !key.bytes().all(|v| v.is_ascii_alphanumeric()) {
        return Err("Clé Ticketmaster invalide.".into());
    }
    Ok(())
}
fn project(value: &Value, artist: &str, page: u32) -> Result<Value, String> {
    let total = value["page"]["totalPages"].as_u64().ok_or(INVALID)?;
    if value["page"]["number"].as_u64() != Some(u64::from(page)) || total > 100_000 {
        return Err(INVALID.into());
    }
    let empty = Vec::new();
    let rows = match value["_embedded"]["events"].as_array() {
        Some(rows) => rows,
        None if total == 0 => &empty,
        None => return Err(INVALID.into()),
    };
    if rows.len() > 100 {
        return Err(INVALID.into());
    }
    let mut ids = BTreeSet::new();
    let mut result = Vec::new();
    let mut events = BTreeSet::new();
    for row in rows {
        let Some(artists) = row["_embedded"]["attractions"].as_array() else {
            continue;
        };
        let matches: Vec<_> = artists
            .iter()
            .filter(|a| text(&a["name"]).is_some_and(|n| normalized(n) == normalized(artist)))
            .collect();
        if matches.is_empty() {
            continue;
        }
        for a in matches {
            ids.insert(text(&a["id"]).ok_or(INVALID)?.to_owned());
        }
        let id = text(&row["id"]).ok_or(INVALID)?;
        if !events.insert(id) {
            return Err(INVALID.into());
        }
        let venue = &row["_embedded"]["venues"][0];
        let start = &row["dates"]["start"];
        let date = text(&start["localDate"])
            .filter(|v| v.len() == 10 && v.as_bytes()[4] == b'-' && v.as_bytes()[7] == b'-');
        let time = text(&start["localTime"])
            .filter(|v| v.len() == 8 && v.as_bytes()[2] == b':' && v.as_bytes()[5] == b':');
        result.push(json!({"id":id,"title":text(&row["name"]).ok_or(INVALID)?,"url":link(&row["url"]),
    "date":date,"time":time,"timezone":text(&row["dates"]["timezone"]),"status":text(&row["dates"]["status"]["code"]),
    "venue":text(&venue["name"]),"city":text(&venue["city"]["name"]),"country":text(&venue["country"]["name"]),
    "countryCode":text(&venue["country"]["countryCode"]),"address":text(&venue["address"]["line1"]),
    "info":text(&row["info"]),"notice":text(&row["pleaseNote"]),"price":row["priceRanges"].as_array().and_then(|v|v.first()).map(|price|json!({"min":price["min"].as_f64(),"max":price["max"].as_f64(),"currency":text(&price["currency"])}))}));
    }
    if ids.len() > 1 {
        return Err(
            "Plusieurs artistes Ticketmaster portent ce nom : correspondance ambiguë.".into(),
        );
    }
    Ok(
        json!({"items":result,"pages":total,"page":page,"artistId":ids.into_iter().next(),"source":"Ticketmaster Discovery"}),
    )
}
/// One serialized provider client imposes bounded reads and a two-request-per-second ceiling.
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
    /// Explicit page lookup; exact performer matching excludes title-only and tribute results.
    pub fn events(&mut self, key: &str, artist: &str, page: u32) -> Result<Value, String> {
        validate_key(key)?;
        let artist = artist.trim();
        if artist.is_empty()
            || artist.len() > 200
            || artist.chars().any(char::is_control)
            || page >= 10
        {
            return Err("Recherche de concerts invalide.".into());
        }
        if let Some(last) = self.last {
            let delay = Duration::from_millis(500).saturating_sub(last.elapsed());
            if !delay.is_zero() {
                std::thread::sleep(delay);
            }
        }
        self.last = Some(Instant::now());
        let mut response = self
            .agent
            .get("https://app.ticketmaster.com/discovery/v2/events.json")
            .header("Accept", "application/json")
            .header("User-Agent", "Phemios/0.1.0")
            .query("apikey", key)
            .query("keyword", artist)
            .query("classificationName", "music")
            .query("locale", "*")
            .query("sort", "date,asc")
            .query("size", "100")
            .query("page", page.to_string())
            .call()
            .map_err(|error| match error {
                ureq::Error::StatusCode(429) => {
                    "Limite Ticketmaster atteinte. Réessayez plus tard."
                }
                ureq::Error::StatusCode(401 | 403) => "Clé Ticketmaster refusée.",
                _ => "Ticketmaster indisponible. Réessayez plus tard.",
            })?;
        let body = response
            .body_mut()
            .with_config()
            .limit(2 * 1024 * 1024)
            .read_to_vec()
            .map_err(|_| "Réponse Ticketmaster trop grande ou interrompue.")?;
        let value = serde_json::from_slice(&body).map_err(|_| INVALID)?;
        project(&value, artist, page)
    }
}
#[cfg(test)]
#[path = "concerts_tests.rs"]
mod tests;
