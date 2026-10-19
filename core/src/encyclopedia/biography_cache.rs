//! Disposable public biography copies, separate from explicitly saved account-private articles.
use super::{
    Client, article_result, checked_response, language, page_id, title,
    translation::checked_article_title,
};
use crate::cache::{read, write_atomic};
use serde_json::{Value, json};
use std::path::PathBuf;
const LIMIT: u64 = 12 * 1024 * 1024;
const COUNT: usize = 40;
const INVALID: &str = "Cache des biographies illisible.";
/// One native-owned, bounded file; edition and exact attributed title are checked inside every entry.
/// The native bridge serializes access. No path or owner identifier comes from the WebView.
#[derive(Clone)]
pub struct Store {
    path: PathBuf,
}
impl Store {
    /// Construct without reading or creating files.
    pub fn new(root: PathBuf) -> Self {
        Self {
            path: root.join("biographies.json"),
        }
    }
    fn rows(&self) -> Result<Vec<Value>, String> {
        let Some(bytes) = read(&self.path, LIMIT)? else {
            return Ok(Vec::new());
        };
        let mut value: Value = serde_json::from_slice(&bytes).map_err(|_| INVALID)?;
        if value["version"] != 1 {
            return Err(INVALID.into());
        }
        let rows = value
            .get_mut("rows")
            .and_then(Value::as_array_mut)
            .filter(|rows| rows.len() <= COUNT)
            .ok_or(INVALID)?;
        let mut keys = std::collections::HashSet::new();
        for row in rows.iter() {
            let lang = row["language"].as_str().ok_or(INVALID)?;
            let name = row["name"].as_str().ok_or(INVALID)?;
            language(lang)?;
            checked_article_title(name)?;
            validate(&row["article"], lang)?;
            if !keys.insert((lang, name)) {
                return Err(INVALID.into());
            }
        }
        Ok(std::mem::take(rows))
    }
    /// Read a retained copy without network traffic, including after application restart.
    pub fn get(&self, lang: &str, name: &str) -> Result<Option<Value>, String> {
        language(lang)?;
        checked_article_title(name)?;
        Ok(self
            .rows()?
            .into_iter()
            .find(|row| row["language"] == lang && row["name"] == name)
            .map(|mut row| row["article"].take()))
    }
    fn save(&self, lang: &str, name: &str, article: &Value) -> Result<(), String> {
        validate(article, lang)?;
        let mut rows = self.rows()?;
        rows.retain(|row| row["language"] != lang || row["name"] != name);
        rows.push(json!({"language":lang,"name":name,"article":article}));
        loop {
            let bytes =
                serde_json::to_vec(&json!({"version":1,"rows":rows})).map_err(|_| INVALID)?;
            if rows.len() <= COUNT && bytes.len() as u64 <= LIMIT {
                return write_atomic(&self.path, &bytes);
            }
            rows.remove(0);
        }
    }
    fn refresh(
        &self,
        lang: &str,
        name: &str,
        mut request: impl FnMut(bool) -> Result<Value, String>,
    ) -> Result<Value, String> {
        let retained = self.get(lang, name)?;
        if let Some(article) = retained {
            let metadata = request(false)?;
            let page = single_page(&metadata)?;
            let id = page_id(page["pageid"].as_u64().ok_or(INVALID)?)?;
            let revision = page_id(page["lastrevid"].as_u64().ok_or(INVALID)?)?;
            if article["pageId"] == id
                && article["revision"] == revision
                && article["title"] == title(page)?
                && article.get("externalLinks").is_some()
            {
                return Ok(article);
            }
        }
        let response = request(true)?;
        let page = single_page(&response)?;
        let at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| "Horloge système invalide.")?
            .as_millis();
        let article = article_result(
            &response,
            lang,
            page_id(page["pageid"].as_u64().ok_or(INVALID)?)?,
            u64::try_from(at).map_err(|_| INVALID)?,
        )?;
        self.save(lang, name, &article)?;
        Ok(article)
    }
}
fn single_page(value: &Value) -> Result<&Value, String> {
    let pages = checked_response(value)?["pages"]
        .as_array()
        .filter(|pages| pages.len() == 1)
        .ok_or(INVALID)?;
    let row = &pages[0];
    if row["ns"] != 0 || row.get("missing").is_some() || row.get("invalid").is_some() {
        return Err("Article Wikipédia indisponible.".into());
    }
    Ok(row)
}
fn validate(article: &Value, lang: &str) -> Result<(), String> {
    let id = page_id(article["pageId"].as_u64().ok_or(INVALID)?)?;
    let at = article["retrievedAt"]
        .as_u64()
        .filter(|at| *at > 0 && *at <= 8_640_000_000_000_000)
        .ok_or(INVALID)?;
    let mut response = json!({"query":{"pages":[{"ns":0,"pageid":id,"title":article["title"],"lastrevid":article["revision"],"extract":article["text"]}]}});
    if let Some(links) = article.get("externalLinks") {
        response["query"]["pages"][0]["externalLinks"] = links.clone();
    }
    let checked = article_result(&response, lang, id, at)?;
    if checked != *article
        || article["text"].as_str().is_none_or(|text| {
            text.chars()
                .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
        })
    {
        return Err(INVALID.into());
    }
    Ok(())
}
impl Client {
    /// Revalidate public identity/revision on explicit reopen; fetch full text only when absent/changed.
    /// A failed revalidation leaves the retained copy intact, so the reader can report it while offline.
    pub fn retained_biography(
        &self,
        store: &Store,
        lang: &str,
        name: &str,
    ) -> Result<Value, String> {
        language(lang)?;
        checked_article_title(name)?;
        store.refresh(lang, name, |text| {
            let mut params = vec![
                ("titles", name),
                ("redirects", "1"),
                ("prop", if text { "extracts|info" } else { "info" }),
            ];
            if text {
                params.extend([("explaintext", "1"), ("exsectionformat", "wiki")]);
            }
            if text {
                self.request_article(lang, &params)
            } else {
                self.request(lang, &params)
            }
        })
    }
}
#[cfg(test)]
#[path = "biography_cache_tests.rs"]
mod tests;
