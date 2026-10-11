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
    /// Synchronize both complete same-epoch projections under the cache's shared JSON-byte limit.
    /// Oversized pages fail before retention; differing artist/album epochs allow three attempts.
    pub fn snapshot(&self) -> Result<Value, String> {
        for _ in 0..3 {
            let mut budget = SnapshotBudget {
                remaining: crate::cache::MAX_CATALOG,
            };
            // Reserve the fixed wrapper first; page-array overhead is deliberately conservative.
            budget.reserve(&json!({"artists":[],"albums":[],"scannedAt":u64::MAX,"server":self.server,"accountId":self.account["id"]}))?;
            let artists = self.pages("/api/v1/presentation/artists", &mut budget)?;
            let albums = self.pages("/api/v1/presentation/albums", &mut budget)?;
            if artists.1 == albums.1 {
                return Ok(
                    json!({"artists":artists.0,"albums":albums.0,"scannedAt":artists.1,"server":self.server,"accountId":self.account["id"]}),
                );
            }
        }
        Err("Le catalogue change pendant la synchronisation. Réessayez.".into())
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
