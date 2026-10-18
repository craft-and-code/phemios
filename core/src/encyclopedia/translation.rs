//! Resolve counterpart identities through Wikipedia's own interlanguage relation, never title search.
use super::{Client, article_result, checked_response, language, page_id, title};
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};
const MISSING: &str = "Cet article n’a pas de version dans la langue demandée.";
fn counterpart_title<'a>(value: &'a Value, id: u64, target: &str) -> Result<&'a str, String> {
    let pages = checked_response(value)?["pages"]
        .as_array()
        .filter(|pages| pages.len() == 1)
        .ok_or("Réponse Wikipédia invalide.")?;
    let page = &pages[0];
    if page["pageid"].as_u64() != Some(id)
        || page["ns"].as_u64() != Some(0)
        || page.get("missing").is_some()
        || page.get("invalid").is_some()
    {
        return Err("Article Wikipédia indisponible.".into());
    }
    let Some(links) = page.get("langlinks") else {
        return Err(MISSING.into());
    };
    let links = links.as_array().ok_or("Réponse Wikipédia invalide.")?;
    if links.is_empty() {
        return Err(MISSING.into());
    }
    if links.len() != 1 || links[0]["lang"].as_str() != Some(target) {
        return Err("Réponse Wikipédia invalide.".into());
    }
    let name = title(&links[0])?;
    // Neither multi-page query separators nor section fragments identify one complete article.
    if name.contains(['|', '#']) {
        return Err("Réponse Wikipédia invalide.".into());
    }
    Ok(name)
}
fn counterpart_result(value: &Value, target: &str, at: u64) -> Result<Value, String> {
    let pages = checked_response(value)?["pages"]
        .as_array()
        .filter(|pages| pages.len() == 1)
        .ok_or("Réponse Wikipédia invalide.")?;
    let id = page_id(
        pages[0]["pageid"]
            .as_u64()
            .ok_or("Article Wikipédia indisponible.")?,
    )?;
    article_result(value, target, id, at)
}
pub(super) fn checked_article_title(name: &str) -> Result<&str, String> {
    if name.trim().is_empty()
        || name.len() > 2048
        || name.chars().any(char::is_control)
        || name.contains(['|', '#'])
    {
        return Err("Titre Wikipédia invalide.".into());
    }
    Ok(name)
}
impl Client {
    /// Read one exact attributed title through fixed FR/EN hosts; never perform a name search.
    pub fn named_article(&self, lang: &str, name: &str) -> Result<Value, String> {
        language(lang)?;
        let name = checked_article_title(name)?;
        let article = self.request(
            lang,
            &[
                ("titles", name),
                ("redirects", "1"),
                ("prop", "extracts|info"),
                ("explaintext", "1"),
                ("exsectionformat", "wiki"),
            ],
        )?;
        let at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "Horloge système invalide.")?
            .as_millis();
        counterpart_result(
            &article,
            lang,
            u64::try_from(at).map_err(|_| "Horloge système invalide.")?,
        )
    }
    /// Explicitly follow one FR/EN interlanguage link and read its canonical main-namespace page.
    /// Both requests retain fixed public hosts, limits and provenance, without executing returned URLs.
    pub fn translated_article(&self, source: &str, id: u64, target: &str) -> Result<Value, String> {
        language(source)?;
        language(target)?;
        let id = page_id(id)?;
        if source == target {
            return self.article(source, id);
        }
        let relation = self.request(
            source,
            &[
                ("pageids", &id.to_string()),
                ("prop", "langlinks"),
                ("lllang", target),
                ("lllimit", "1"),
            ],
        )?;
        let name = counterpart_title(&relation, id, target)?;
        let article = self.request(
            target,
            &[
                ("titles", name),
                ("redirects", "1"),
                ("prop", "extracts|info"),
                ("explaintext", "1"),
                ("exsectionformat", "wiki"),
            ],
        )?;
        let at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "Horloge système invalide.")?
            .as_millis();
        counterpart_result(
            &article,
            target,
            u64::try_from(at).map_err(|_| "Horloge système invalide.")?,
        )
    }
}
#[cfg(test)]
#[path = "translation_tests.rs"]
mod tests;
