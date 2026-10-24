//! Explicit Wikipedia text retrieval, independent of Aède authority and offline navigation.
use serde_json::{Value, json};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use ureq::unversioned::transport::DefaultConnector;

pub mod biography_cache;
pub(crate) mod resources;
mod translation;

const MAX_ID: u64 = 9_007_199_254_740_991;
const RESPONSE_LIMIT: u64 = 1024 * 1024;
fn language(value: &str) -> Result<&str, String> {
    match value {
        "fr" | "en" => Ok(value),
        _ => Err("Langue Wikipédia non prise en charge.".into()),
    }
}
fn page_id(value: u64) -> Result<u64, String> {
    if value == 0 || value > MAX_ID {
        return Err("Identifiant Wikipédia invalide.".into());
    }
    Ok(value)
}
fn query(value: &str) -> Result<&str, String> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 200 || value.chars().any(char::is_control) {
        return Err("Saisissez une recherche de 1 à 200 caractères.".into());
    }
    Ok(value)
}
fn title(page: &Value) -> Result<&str, String> {
    page.get("title")
        .and_then(Value::as_str)
        .filter(|s| !s.trim().is_empty() && s.len() <= 2048 && !s.chars().any(char::is_control))
        .ok_or_else(|| "Réponse Wikipédia invalide.".into())
}
fn checked_response(value: &Value) -> Result<&Value, String> {
    if value.get("error").is_some() {
        return Err("Wikipédia a refusé la requête. Réessayez plus tard.".into());
    }
    value
        .get("query")
        .ok_or_else(|| "Réponse Wikipédia invalide.".into())
}
fn search_result(value: &Value, lang: &str) -> Result<Value, String> {
    let rows = checked_response(value)?["search"]
        .as_array()
        .filter(|rows| rows.len() <= 20)
        .ok_or("Réponse Wikipédia invalide.")?;
    let rows = rows.iter().map(|row| {
        if row["ns"].as_u64() != Some(0) {
            return Err("Réponse Wikipédia invalide.".into());
        }
        Ok(json!({"pageId": page_id(row["pageid"].as_u64().ok_or("Réponse Wikipédia invalide.")?)?,
            "title": title(row)?}))
    }).collect::<Result<Vec<Value>, String>>()?;
    let mut ids = std::collections::HashSet::new();
    if rows.iter().any(|row| !ids.insert(row["pageId"].as_u64())) {
        return Err("Réponse Wikipédia invalide.".into());
    }
    Ok(json!({"language":lang,"rows":rows}))
}
fn article_result(value: &Value, lang: &str, id: u64, retrieved_at: u64) -> Result<Value, String> {
    let rows = checked_response(value)?["pages"]
        .as_array()
        .ok_or("Réponse Wikipédia invalide.")?;
    if rows.len() != 1 {
        return Err("Article Wikipédia indisponible.".into());
    }
    let row = &rows[0];
    if row["pageid"].as_u64() != Some(id)
        || row["ns"].as_u64() != Some(0)
        || row.get("missing").is_some()
        || row.get("invalid").is_some()
    {
        return Err("Article Wikipédia indisponible.".into());
    }
    let text = row["extract"]
        .as_str()
        .filter(|text| !text.trim().is_empty() && text.len() <= 512 * 1024)
        .ok_or("Texte Wikipédia indisponible ou trop volumineux.")?;
    let revision = page_id(
        row["lastrevid"]
            .as_u64()
            .ok_or("Réponse Wikipédia invalide.")?,
    )?;
    let mut article = json!({"language":lang,"pageId":id,"revision":revision,"title":title(row)?,
        "text":text,"retrievedAt":retrieved_at});
    if let Some(links) = row.get("externalLinks") {
        resources::validate(links)?;
        article["externalLinks"] = links.clone();
    }
    Ok(article)
}
/// A fixed-host, public-only client; no arbitrary URL, cookies, credentials or redirect is accepted.
pub struct Client {
    agent: ureq::Agent,
}
impl Default for Client {
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
        }
    }
}
impl Client {
    fn request(&self, lang: &str, params: &[(&str, &str)]) -> Result<Value, String> {
        self.request_action(lang, "query", params, RESPONSE_LIMIT)
    }
    fn request_action(
        &self,
        lang: &str,
        action: &str,
        params: &[(&str, &str)],
        limit: u64,
    ) -> Result<Value, String> {
        let host = language(lang)?;
        let mut request = self
            .agent
            .get(format!("https://{host}.wikipedia.org/w/api.php"))
            .header(
                "User-Agent",
                concat!(
                    "Phemios/",
                    env!("CARGO_PKG_VERSION"),
                    " (https://craft-and-code.github.io/aede/; music encyclopedia)"
                ),
            )
            .header("Accept", "application/json")
            .query("action", action)
            .query("format", "json")
            .query("formatversion", "2")
            .query("maxlag", "5");
        for (key, value) in params {
            request = request.query(*key, *value);
        }
        let mut response = request.call().map_err(
            |_| "Wikipédia indisponible. Vérifiez votre connexion ou réessayez plus tard.",
        )?;
        let bytes = response
            .body_mut()
            .with_config()
            .limit(limit)
            .read_to_vec()
            .map_err(|_| "Réponse Wikipédia trop grande ou interrompue.")?;
        serde_json::from_slice(&bytes).map_err(|_| "Réponse Wikipédia invalide.".into())
    }
    /// Explicit full-text search returns at most twenty main-namespace titles without remote HTML.
    pub fn search(&self, lang: &str, term: &str) -> Result<Value, String> {
        let term = query(term)?;
        search_result(
            &self.request(
                lang,
                &[
                    ("list", "search"),
                    ("srsearch", term),
                    ("srnamespace", "0"),
                    ("srlimit", "20"),
                    ("srprop", ""),
                ],
            )?,
            lang,
        )
    }
    /// Read a bounded plain-text extract, retaining the revision reported by the same API response.
    pub fn article(&self, lang: &str, id: u64) -> Result<Value, String> {
        let id = page_id(id)?;
        let value = self.request_article(
            lang,
            &[
                ("pageids", &id.to_string()),
                ("prop", "extracts|info"),
                ("explaintext", "1"),
                ("exsectionformat", "wiki"),
            ],
        )?;
        let at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "Horloge système invalide.")?
            .as_millis();
        article_result(
            &value,
            lang,
            id,
            u64::try_from(at).map_err(|_| "Horloge système invalide.")?,
        )
    }
}
#[cfg(test)]
#[path = "encyclopedia_tests.rs"]
mod tests;
