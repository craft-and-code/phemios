//! Persistent private podcast documents; callers supply only a trusted native Client.
use crate::{federation::Source, network::Client, private_documents};
use serde_json::{Value, json};
#[cfg(test)]
use std::fs;
use std::path::PathBuf;
const PART_BYTES: usize = 4 * 1024 * 1024;
#[cfg(test)]
const MAX_BYTES: usize = 2 * PART_BYTES + 4096;
/// Fixed application-owned folder, serialized by the native bridge.
pub struct Store {
    document: private_documents::Store,
}
impl Store {
    /// Construction never reads, creates or repairs a retained object.
    pub fn new(root: PathBuf) -> Self {
        Self {
            document: private_documents::Store::new(root, private_documents::Kind::Podcasts),
        }
    }
    fn owner(source: Source, client: &Client) -> Result<Value, String> {
        private_documents::owner(source, client)
    }
    #[cfg(test)]
    fn path(&self, owner: &Value) -> PathBuf {
        self.document.path(owner)
    }
    fn document(&self, owner: &Value) -> Result<Value, String> {
        let value = self
            .document
            .read(owner)?
            .unwrap_or_else(|| json!({"feeds":[],"episodes":[]}));
        validate(&value)?;
        Ok(value)
    }
    /// Prepare an additive explicit restore, retaining current subscriptions/evidence and document extensions.
    pub(crate) fn prepare_restore(
        &self,
        source: Source,
        client: &Client,
        imported: &Value,
    ) -> Result<Value, String> {
        writable(client)?;
        validate(imported)?;
        let owner = Self::owner(source, client)?;
        let mut value = self.document(&owner)?;
        for field in ["feeds", "episodes"] {
            let incoming = imported[field]
                .as_array()
                .ok_or("Données podcasts illisibles.")?;
            let held = value[field]
                .as_array_mut()
                .ok_or("Données podcasts illisibles.")?;
            for row in incoming {
                let exists = held.iter().any(|existing| {
                    if field == "feeds" {
                        existing["url"] == row["url"]
                    } else {
                        existing["feed"] == row["feed"] && existing["id"] == row["id"]
                    }
                });
                if !exists {
                    held.push(row.clone());
                }
            }
        }
        validate(&value)?;
        self.document.preflight(&owner, &value)?;
        Ok(value)
    }
    /// Publish a previously preflighted restore while the bridge retains this store lock.
    pub(crate) fn commit_restore(
        &self,
        source: Source,
        client: &Client,
        prepared: Value,
    ) -> Result<(), String> {
        writable(client)?;
        validate(&prepared)?;
        self.document.write(&Self::owner(source, client)?, prepared)
    }
    /// Read only this authenticated source/authority/account; legacy device stores are unrelated.
    pub fn read(&self, source: Source, client: &Client) -> Result<Value, String> {
        let value = self.document(&Self::owner(source, client)?)?;
        Ok(json!({"feeds":value["feeds"],"episodes":value["episodes"]}))
    }
    /// Apply one narrow mutation without trusting a webview owner, pathname or full replacement.
    pub fn update(
        &self,
        source: Source,
        client: &Client,
        action: &str,
        payload: &Value,
    ) -> Result<Value, String> {
        writable(client)?;
        let owner = Self::owner(source, client)?;
        let mut value = self.document(&owner)?;
        match action {
            "save" => {
                validate_feed(payload)?;
                let rows = value["feeds"]
                    .as_array_mut()
                    .ok_or("Données podcasts illisibles.")?;
                if let Some(row) = rows.iter_mut().find(|row| row["url"] == payload["url"]) {
                    *row = payload.clone();
                } else {
                    rows.push(payload.clone());
                }
            }
            "remove" => {
                let url = payload.as_str().ok_or("Adresse podcast invalide.")?;
                crate::podcast::feed_address(url)?;
                value["feeds"]
                    .as_array_mut()
                    .ok_or("Données podcasts illisibles.")?
                    .retain(|row| row["url"] != url);
            }
            "mark" => {
                validate_marker(payload)?;
                let rows = value["episodes"]
                    .as_array_mut()
                    .ok_or("Données podcasts illisibles.")?;
                if !rows.iter().any(|row| row == payload) {
                    rows.push(payload.clone());
                }
            }
            _ => return Err("Action podcast invalide.".into()),
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
        Err("Ce compte ne peut pas modifier ses podcasts.".into())
    }
}

fn text(value: &Value, max: usize, empty: bool) -> bool {
    value.as_str().is_some_and(|text| {
        text.encode_utf16().count() <= max && (empty || !text.trim().is_empty())
    })
}
// The RSS parser emits Date.toISOString(), including signed six-digit years.
fn canonical_date(value: &Value) -> bool {
    if value.is_null() {
        return true;
    }
    let Some(date) = value.as_str().filter(|s| s.is_ascii()) else {
        return false;
    };
    let (year, offset) = match date.len() {
        24 if date.as_bytes()[..4].iter().all(u8::is_ascii_digit) => {
            (date.get(..4).and_then(|s| s.parse::<i32>().ok()), 4)
        }
        27 if matches!(date.as_bytes()[0], b'+' | b'-')
            && date.as_bytes()[1..7].iter().all(u8::is_ascii_digit) =>
        {
            let year = date
                .get(1..7)
                .and_then(|s| s.parse::<i32>().ok())
                .map(|n| if date.starts_with('-') { -n } else { n });
            if year.is_some_and(|n| (0..=9999).contains(&n)) {
                return false;
            }
            (year, 7)
        }
        _ => return false,
    };
    let Some(year) = year else {
        return false;
    };
    let tail = &date[offset..];
    if !tail.as_bytes().iter().enumerate().all(|(i, b)| match i {
        0 | 3 => *b == b'-',
        6 => *b == b'T',
        9 | 12 => *b == b':',
        15 => *b == b'.',
        19 => *b == b'Z',
        _ => b.is_ascii_digit(),
    }) {
        return false;
    }
    let number = |start, end| tail.get(start..end).and_then(|s| s.parse::<i32>().ok());
    let (Some(month), Some(day), Some(hour), Some(minute), Some(second), Some(ms)) = (
        number(1, 3),
        number(4, 6),
        number(7, 9),
        number(10, 12),
        number(13, 15),
        number(16, 19),
    ) else {
        return false;
    };
    let leap = year.rem_euclid(4) == 0 && (year.rem_euclid(100) != 0 || year.rem_euclid(400) == 0);
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if leap {
                29
            } else {
                28
            }
        }
        _ => return false,
    };
    if !(1..=days).contains(&day) || hour > 23 || minute > 59 || second > 59 {
        return false;
    }
    let stamp = (year, month, day, hour, minute, second, ms);
    ((-271_821, 4, 20, 0, 0, 0, 0)..=(275_760, 9, 13, 0, 0, 0, 0)).contains(&stamp)
}
fn validate_marker(value: &Value) -> Result<(), String> {
    if !value.is_object() || !text(&value["id"], 4096, false) {
        return Err("Épisodes écoutés illisibles.".into());
    }
    crate::podcast::feed_address(value["feed"].as_str().ok_or("Adresse podcast invalide.")?)?;
    Ok(())
}
fn validate_feed(value: &Value) -> Result<(), String> {
    crate::podcast::feed_address(value["url"].as_str().ok_or("Adresse podcast invalide.")?)?;
    if !text(&value["title"], 512, false) || !text(&value["author"], 512, true) {
        return Err("Abonnements podcasts illisibles.".into());
    }
    let episodes = value["episodes"]
        .as_array()
        .filter(|rows| rows.len() <= 200)
        .ok_or("Abonnements podcasts illisibles.")?;
    let mut ids = std::collections::BTreeSet::new();
    for row in episodes {
        if !text(&row["id"], 2048, false)
            || !text(&row["title"], 512, false)
            || !text(&row["summary"], 4096, true)
            || !row.get("date").is_some_and(canonical_date)
            || !row.get("duration").is_some_and(|value| {
                value.is_null()
                    || value
                        .as_f64()
                        .is_some_and(|n| n.is_finite() && n > 0. && n <= 86400.)
            })
            || !ids.insert(
                row["id"]
                    .as_str()
                    .ok_or("Abonnements podcasts illisibles.")?,
            )
        {
            return Err("Abonnements podcasts illisibles.".into());
        }
        crate::podcast::feed_address(row["url"].as_str().ok_or("Adresse podcast invalide.")?)?;
    }
    Ok(())
}
pub(crate) fn validate(value: &Value) -> Result<(), String> {
    let feeds = value["feeds"]
        .as_array()
        .filter(|rows| rows.len() <= 100)
        .ok_or("Abonnements podcasts illisibles.")?;
    let episodes = value["episodes"]
        .as_array()
        .filter(|rows| rows.len() <= 4096)
        .ok_or("Épisodes écoutés illisibles.")?;
    if serde_json::to_vec(feeds)
        .map_err(|_| "Abonnements podcasts illisibles.")?
        .len()
        > PART_BYTES
        || serde_json::to_vec(episodes)
            .map_err(|_| "Épisodes écoutés illisibles.")?
            .len()
            > PART_BYTES
    {
        return Err("Limite de stockage des podcasts atteinte.".into());
    }
    let mut urls = std::collections::BTreeSet::new();
    for feed in feeds {
        validate_feed(feed)?;
        if !urls.insert(feed["url"].as_str().ok_or("Adresse podcast invalide.")?) {
            return Err("Abonnements podcasts illisibles.".into());
        }
    }
    let mut markers = std::collections::BTreeSet::new();
    for marker in episodes {
        validate_marker(marker)?;
        if !markers.insert(marker.to_string()) {
            return Err("Épisodes écoutés illisibles.".into());
        }
    }
    Ok(())
}
#[cfg(test)]
#[path = "podcast_store_tests.rs"]
mod tests;
