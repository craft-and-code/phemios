//! Bounded owner-private saved article metadata/text; public fetch/export stays independent.
use crate::{federation::Source, network::Client, private_documents};
use serde_json::{Value, json};
use std::path::PathBuf;
/// Fixed native-owned folder; callers supply only authenticated Client identity.
pub struct Store {
    document: private_documents::Store,
}
impl Store {
    /// Construct without creating or repairing a retained object.
    pub fn new(root: PathBuf) -> Self {
        Self {
            document: private_documents::Store::new(root, private_documents::Kind::Articles),
        }
    }
    fn document(&self, owner: &Value) -> Result<Value, String> {
        let value = self
            .document
            .read(owner)?
            .unwrap_or_else(|| json!({"articles":[]}));
        validate(&value)?;
        Ok(value)
    }
    /// Prepare an additive explicit restore without replacing current editions or document extensions.
    pub(crate) fn prepare_restore(
        &self,
        source: Source,
        client: &Client,
        imported: &Value,
    ) -> Result<Value, String> {
        writable(client)?;
        validate(imported)?;
        let owner = private_documents::owner(source, client)?;
        let mut value = self.document(&owner)?;
        let incoming = imported["articles"]
            .as_array()
            .ok_or("Articles enregistrés illisibles.")?;
        let held = value["articles"]
            .as_array_mut()
            .ok_or("Articles enregistrés illisibles.")?;
        for row in incoming {
            if !held.iter().any(|existing| {
                existing["language"] == row["language"] && existing["pageId"] == row["pageId"]
            }) {
                held.push(row.clone());
            }
        }
        validate(&value)?;
        self.document.preflight(&owner, &value)?;
        Ok(value)
    }
    /// Publish a preflighted restore while the bridge retains this store lock.
    pub(crate) fn commit_restore(
        &self,
        source: Source,
        client: &Client,
        prepared: Value,
    ) -> Result<(), String> {
        writable(client)?;
        validate(&prepared)?;
        self.document
            .write(&private_documents::owner(source, client)?, prepared)
    }
    /// Read this source/authority/account's articles, without inspecting legacy device storage.
    pub fn read(&self, source: Source, client: &Client) -> Result<Value, String> {
        let value = self.document(&private_documents::owner(source, client)?)?;
        Ok(json!({"version":1,"articles":value["articles"]}))
    }
    /// Save/remove one identity, never a caller-selected owner, path or complete replacement.
    pub fn update(
        &self,
        source: Source,
        client: &Client,
        action: &str,
        payload: &Value,
    ) -> Result<Value, String> {
        writable(client)?;
        identity(payload)?;
        let owner = private_documents::owner(source, client)?;
        let mut value = self.document(&owner)?;
        let rows = value["articles"]
            .as_array_mut()
            .ok_or("Articles enregistrés illisibles.")?;
        let same = |row: &Value| {
            row["language"] == payload["language"] && row["pageId"] == payload["pageId"]
        };
        match action {
            "save" => {
                article(payload)?;
                if let Some(row) = rows.iter_mut().find(|row| same(row)) {
                    *row = payload.clone();
                } else {
                    rows.push(payload.clone());
                }
            }
            "remove" => rows.retain(|row| !same(row)),
            _ => return Err("Action article invalide.".into()),
        }
        validate(&value)?;
        self.document.write(&owner, value)?;
        self.read(source, client)
    }
}
fn writable(client: &Client) -> Result<(), String> {
    if matches!(
        client.account()["account"]["role"].as_str(),
        Some("user" | "admin")
    ) {
        Ok(())
    } else {
        Err("Ce compte ne peut pas modifier ses articles.".into())
    }
}

fn identity(value: &Value) -> Result<(), String> {
    if !matches!(value["language"].as_str(), Some("fr" | "en")) || !positive(&value["pageId"]) {
        return Err("Article enregistré invalide.".into());
    }
    Ok(())
}
fn positive(value: &Value) -> bool {
    value
        .as_u64()
        .is_some_and(|n| n > 0 && n <= 9_007_199_254_740_991)
}
fn article(value: &Value) -> Result<(), String> {
    identity(value)?;
    if let Some(links) = value.get("externalLinks") {
        crate::encyclopedia::resources::validate(links)?;
    }
    let title = value["title"].as_str().is_some_and(|s| {
        !s.trim().is_empty() && s.encode_utf16().count() <= 2048 && !s.chars().any(char::is_control)
    });
    let text = value["text"].as_str().is_some_and(|s| {
        !s.trim().is_empty()
            && s.len() <= 512 * 1024
            && !s
                .chars()
                .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
    });
    if !positive(&value["revision"])
        || !value["retrievedAt"]
            .as_u64()
            .is_some_and(|n| n > 0 && n <= 8_640_000_000_000_000)
        || !title
        || !text
    {
        return Err("Article enregistré invalide.".into());
    }
    Ok(())
}
pub(crate) fn validate(value: &Value) -> Result<(), String> {
    let rows = value["articles"]
        .as_array()
        .filter(|rows| rows.len() <= 40)
        .ok_or("Articles enregistrés illisibles.")?;
    if serde_json::to_vec(rows)
        .map_err(|_| "Articles enregistrés illisibles.")?
        .len()
        > 3 * 1024 * 1024
    {
        return Err("Limite de stockage des articles atteinte.".into());
    }
    let mut ids = std::collections::BTreeSet::new();
    for row in rows {
        article(row)?;
        if !ids.insert((row["language"].as_str(), row["pageId"].as_u64())) {
            return Err("Articles enregistrés illisibles.".into());
        }
    }
    Ok(())
}
#[cfg(test)]
#[path = "article_store_tests.rs"]
mod tests;
