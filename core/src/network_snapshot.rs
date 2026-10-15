//! Complete same-epoch presentation, bounded before retaining another page.
use super::Client;
use serde_json::{Value, json};
use std::io::{self, Write};

// Count serialized bytes without constructing a second page-sized JSON buffer.
struct SnapshotBudget {
    remaining: u64,
}
impl Write for SnapshotBudget {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.remaining = self
            .remaining
            .checked_sub(bytes.len() as u64)
            .ok_or_else(|| io::Error::other("catalogue limit exceeded"))?;
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
impl SnapshotBudget {
    fn reserve(&mut self, value: &Value) -> Result<(), String> {
        serde_json::to_writer(self, value).map_err(|_| "Catalogue trop grand pour ce cache.".into())
    }
}
impl Client {
    /// Synchronize complete same-epoch public projections under the cache's shared JSON-byte limit.
    /// Oversized pages fail before retention; differing projection epochs allow three attempts.
    pub fn snapshot(&self) -> Result<Value, String> {
        for _ in 0..3 {
            let policy = self.parental_status()?;
            let mut budget = SnapshotBudget {
                remaining: crate::cache::MAX_CATALOG,
            };
            // Reserve the fixed wrapper first; page-array overhead is deliberately conservative.
            budget.reserve(&json!({"artists":[],"albums":[],"tracks":[],"labels":[],"scannedAt":u64::MAX,"server":self.server,"accountId":self.account["id"]}))?;
            if let Some(status) = policy
                .as_ref()
                .filter(|status| status["policy"]["enabled"] == true)
            {
                budget.reserve(&json!({"parentalEnabled": true, "parentalRevision":status["revision"], "parentalPolicy":status["policy"]}))?;
            }
            let artists = self.pages("/api/v1/presentation/artists", &mut budget)?;
            let albums = self.pages("/api/v1/presentation/albums", &mut budget)?;
            let mut tracks = self.pages("/api/v1/presentation/tracks", &mut budget)?;
            for track in &mut tracks.0 {
                let fields = track.as_object_mut().ok_or("Piste Aède invalide.")?;
                fields.retain(|key, _| {
                    matches!(
                        key.as_str(),
                        "reference"
                            | "title"
                            | "release"
                            | "album_title"
                            | "disc_no"
                            | "track_no"
                            | "album_position"
                            | "duration_ms"
                            | "analysis_available"
                            | "lyrics_available"
                            | "spectrum_available"
                    )
                });
            }
            let summaries = self.pages("/api/v1/labels", &mut budget)?;
            if artists.1 == albums.1 && artists.1 == tracks.1 && artists.1 == summaries.1 {
                let labels = self.label_details(summaries.0, &mut budget)?;
                if !labels.is_empty() {
                    // Detail responses have no epoch: a final label probe refuses torn associations.
                    let probe = self.request(
                        "GET",
                        "/api/v1/labels",
                        &[("offset", "0"), ("limit", "1")],
                        None,
                    )?;
                    if probe["scanned_at"].as_u64() != Some(artists.1)
                        || probe["total"].as_u64() != Some(labels.len() as u64)
                    {
                        continue;
                    }
                }
                if self
                    .parental_status()?
                    .as_ref()
                    .map(|v| (&v["revision"], &v["policy"]))
                    != policy.as_ref().map(|v| (&v["revision"], &v["policy"]))
                {
                    continue;
                }
                let mut snapshot = json!({"artists":artists.0,"albums":albums.0,"tracks":tracks.0,"labels":labels,"scannedAt":artists.1,"server":self.server,"accountId":self.account["id"]});
                if let Some(policy) = policy.filter(|policy| policy["policy"]["enabled"] == true) {
                    snapshot["parentalEnabled"] = Value::Bool(true);
                    snapshot["parentalRevision"] = policy["revision"].clone();
                    snapshot["parentalPolicy"] = policy["policy"].clone();
                }
                return Ok(snapshot);
            }
        }
        Err("Le catalogue change pendant la synchronisation. Réessayez.".into())
    }
    fn label_details(
        &self,
        summaries: Vec<Value>,
        budget: &mut SnapshotBudget,
    ) -> Result<Vec<Value>, String> {
        let mut labels = Vec::with_capacity(summaries.len());
        for summary in summaries {
            let reference = summary["reference"]
                .as_str()
                .ok_or("Label Aède invalide.")?;
            let detail = self.request("GET", "/api/v1/label", &[("ref", reference)], None)?;
            if detail["reference"] != summary["reference"]
                || detail["name"] != summary["name"]
                || !detail["releases"].is_array()
                || summary["release_count"].as_u64()
                    != detail["releases"].as_array().map(|rows| rows.len() as u64)
            {
                return Err("Label Aède invalide.".into());
            }
            // Copy only this public contract, never arbitrary response extensions or owner data.
            let mut label = json!({"reference":detail["reference"], "name":detail["name"],
                "release_count":summary["release_count"], "releases":detail["releases"]});
            if !detail["biography"].is_null() {
                let prose = &detail["biography"];
                if ["text", "url", "lang", "licence", "source"]
                    .iter()
                    .any(|key| prose[key].as_str().is_none())
                {
                    return Err("Biographie Aède invalide.".into());
                }
                label["biography"] = json!({"text":prose["text"], "url":prose["url"], "lang":prose["lang"], "licence":prose["licence"], "source":prose["source"]});
            }
            budget.reserve(&label)?;
            labels.push(label);
        }
        Ok(labels)
    }
    fn pages(&self, path: &str, budget: &mut SnapshotBudget) -> Result<(Vec<Value>, u64), String> {
        let mut items = Vec::new();
        let mut stamp = None;
        let mut total = None;
        loop {
            let offset = items.len().to_string();
            let mut page =
                self.request("GET", path, &[("offset", &offset), ("limit", "200")], None)?;
            let count = page["total"]
                .as_u64()
                .and_then(|count| usize::try_from(count).ok())
                .filter(|count| *count <= 1_000_000)
                .ok_or("Pagination Aède invalide.")?;
            let at = page["scanned_at"]
                .as_u64()
                .ok_or("Pagination Aède invalide.")?;
            if stamp.is_some_and(|previous| previous != at)
                || total.is_some_and(|previous| previous != count)
            {
                return Err("Le catalogue a changé. Relancez la synchronisation.".into());
            }
            stamp = Some(at);
            total = Some(count);
            let rows = page["items"]
                .as_array()
                .ok_or("Pagination Aède invalide.")?;
            if rows.len() > 200
                || page["offset"].as_u64() != Some(items.len() as u64)
                || items.len() + rows.len() > count
                || rows.is_empty() && items.len() < count
            {
                return Err("Pagination Aède incohérente.".into());
            }
            budget.reserve(&page["items"])?;
            items.append(
                page.get_mut("items")
                    .and_then(Value::as_array_mut)
                    .ok_or("Pagination Aède invalide.")?,
            );
            if items.len() == count {
                return Ok((items, at));
            }
        }
    }
}
