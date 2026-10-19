//! Extract inert labelled resources from the article's own external-links section.
use super::{Client, article_result, page_id};
use scraper::{ElementRef, Html};
use serde_json::{Value, json};
const INVALID: &str = "Liens Wikipédia invalides.";
const LIMIT: usize = 128 * 1024;
fn safe_url(value: &str) -> bool {
    if value.len() > 2048
        || !value.bytes().all(|byte| (0x21..=0x7e).contains(&byte))
        || crate::external_links::browser_url(value).is_err()
    {
        return false;
    }
    let Ok(parsed) = url::Url::parse(value) else {
        return false;
    };
    let Some(host) = parsed.domain() else {
        return false;
    };
    let host = host.strip_suffix('.').unwrap_or(host);
    host.len() <= 253
        && host.contains('.')
        && !host.ends_with(".local")
        && !host.ends_with(".localhost")
        && host.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        })
}
/// Shared validation for public caches, private copies and backup restoration; never fetch a link.
pub(crate) fn validate(value: &Value) -> Result<(), String> {
    let rows = value
        .as_array()
        .filter(|rows| rows.len() <= 256)
        .ok_or(INVALID)?;
    if serde_json::to_vec(rows).map_err(|_| INVALID)?.len() > LIMIT {
        return Err(INVALID.into());
    }
    let mut seen = std::collections::HashSet::new();
    for row in rows {
        let label = row["label"].as_str().ok_or(INVALID)?;
        let url = row["url"].as_str().ok_or(INVALID)?;
        if label.trim().is_empty()
            || label.encode_utf16().count() > 512
            || label.chars().any(char::is_control)
            || !safe_url(url)
            || !seen.insert((label, url))
        {
            return Err(INVALID.into());
        }
    }
    Ok(())
}
fn excluded(element: ElementRef<'_>) -> bool {
    std::iter::once(element)
        .chain(element.ancestors().filter_map(ElementRef::wrap))
        .any(|parent| {
            parent
                .value()
                .classes()
                .any(|class| matches!(class, "navbox" | "mw-editsection" | "metadata"))
        })
}
fn external_section(element: ElementRef<'_>) -> bool {
    element
        .value()
        .attr("id")
        .is_some_and(|id| matches!(id, "Liens_externes" | "External_links"))
        || element.text().collect::<String>().trim() == "Liens externes"
        || element.text().collect::<String>().trim() == "External links"
        || element
            .descendants()
            .filter_map(ElementRef::wrap)
            .any(|child| {
                child
                    .value()
                    .attr("id")
                    .is_some_and(|id| matches!(id, "Liens_externes" | "External_links"))
            })
}
fn extract(html: &str) -> Result<Value, String> {
    if html.len() > 4 * 1024 * 1024 {
        return Err(INVALID.into());
    }
    let document = Html::parse_document(html);
    let mut level: Option<u8> = None;
    let mut links = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for element in document
        .root_element()
        .descendants()
        .filter_map(ElementRef::wrap)
    {
        let name = element.value().name();
        if let Some(heading) = name
            .strip_prefix('h')
            .and_then(|n| n.parse::<u8>().ok())
            .filter(|n| (1..=6).contains(n))
        {
            if excluded(element) {
                continue;
            }
            if external_section(element) {
                level = Some(heading);
            } else if level.is_some_and(|current| heading <= current) {
                level = None;
            }
        }
        if level.is_none()
            || name != "a"
            || !element.value().classes().any(|class| class == "external")
        {
            continue;
        }
        if excluded(element) {
            continue;
        }
        let Some(url) = element.value().attr("href") else {
            continue;
        };
        let url = if url.starts_with("//") {
            format!("https:{url}")
        } else {
            url.to_owned()
        };
        let label = element
            .text()
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        if label.is_empty() || label.encode_utf16().count() > 512 || !safe_url(&url) {
            continue;
        }
        if seen.insert((label.clone(), url.clone())) {
            links.push(json!({"label":label,"url":url}));
        }
        if links.len() > 256 {
            return Err(INVALID.into());
        }
    }
    let result = Value::Array(links);
    validate(&result)?;
    Ok(result)
}
fn response_links(raw: &Value, id: u64, revision: u64) -> Result<Value, String> {
    let parsed = &raw["parse"];
    if raw.get("error").is_some()
        || parsed["pageid"].as_u64() != Some(id)
        || parsed["revid"].as_u64() != Some(revision)
    {
        return Err(INVALID.into());
    }
    extract(parsed["text"].as_str().ok_or(INVALID)?)
}
impl Client {
    /// Resolve an exact revision through a fixed Wikipedia API; return only validated text/URLs.
    fn resource_links(&self, lang: &str, id: u64, revision: u64) -> Result<Value, String> {
        let raw = self.request_action(
            lang,
            "parse",
            &[
                ("oldid", &revision.to_string()),
                ("prop", "text"),
                ("disableeditsection", "1"),
                ("disablelimitreport", "1"),
            ],
            4 * 1024 * 1024,
        )?;
        response_links(&raw, id, revision)
    }
    pub(super) fn request_article(
        &self,
        lang: &str,
        params: &[(&str, &str)],
    ) -> Result<Value, String> {
        let mut raw = self.request(lang, params)?;
        let pages = super::checked_response(&raw)?["pages"]
            .as_array()
            .filter(|rows| rows.len() == 1)
            .ok_or(INVALID)?;
        let id = page_id(pages[0]["pageid"].as_u64().ok_or(INVALID)?)?;
        let article = article_result(&raw, lang, id, 1)?;
        let revision = article["revision"].as_u64().ok_or(INVALID)?;
        let links = self.resource_links(lang, id, revision)?;
        raw["query"]["pages"][0]["externalLinks"] = links;
        Ok(raw)
    }
}
#[cfg(test)]
#[path = "resources_tests.rs"]
mod tests;
