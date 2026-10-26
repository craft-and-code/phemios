//! Public CD identification; no account, source path, optical lock or audio output is involved.
use serde_json::{Value, json};
use std::{
    collections::VecDeque,
    time::{Duration, Instant},
};
use ureq::unversioned::transport::DefaultConnector;
mod parse;
const LIMIT: u64 = 2 * 1024 * 1024;
fn valid_toc(toc: &[u32]) -> bool {
    toc.len() >= 4
        && toc[0] == 1
        && (1..=99).contains(&toc[1])
        && toc.len() == toc[1] as usize + 3
        && toc[2] <= 540_150
        && toc[3] >= 150
        && toc[3..].windows(2).all(|w| w[0] < w[1])
        && toc.last().is_some_and(|last| *last < toc[2])
}
struct Entry {
    toc: Vec<u32>,
    until: Instant,
    result: Result<Value, String>,
}
/// Bounded process-only metadata cache. The native caller serializes this independent HTTP lane.
pub struct Client {
    agent: ureq::Agent,
    entries: VecDeque<Entry>,
    next: Instant,
}
impl Default for Client {
    fn default() -> Self {
        let config = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(8)))
            .max_redirects(0)
            .proxy(None)
            .build();
        Self {
            agent: ureq::Agent::with_parts(
                config,
                DefaultConnector::default(),
                crate::podcast::PublicResolver,
            ),
            entries: VecDeque::new(),
            next: Instant::now(),
        }
    }
}
impl Client {
    /// Resolve a validated native TOC at a fixed HTTPS origin, at most once a second.
    /// Failures are brief cached misses; neither playback nor the CD registry waits on this lock.
    pub fn identify(&mut self, toc: &[u32]) -> Result<Value, String> {
        if !valid_toc(toc) {
            return Err("Table des pistes du CD invalide.".into());
        }
        if let Some(result) = self.cached(toc, Instant::now()) {
            return result;
        }
        std::thread::sleep(self.next.saturating_duration_since(Instant::now()));
        self.next = Instant::now() + Duration::from_secs(1);
        let result = self.request(toc);
        self.retain(toc, result.clone(), Instant::now());
        result
    }
    fn cached(&self, toc: &[u32], now: Instant) -> Option<Result<Value, String>> {
        self.entries
            .iter()
            .find(|entry| entry.toc == toc && now < entry.until)
            .map(|entry| entry.result.clone())
    }
    fn retain(&mut self, toc: &[u32], result: Result<Value, String>, now: Instant) {
        self.entries
            .retain(|entry| entry.toc != toc && now < entry.until);
        while self.entries.len() >= 32 {
            self.entries.pop_front();
        }
        let seconds = match &result {
            Ok(value) if value["status"] == "matched" => 86_400,
            Ok(_) => 1800,
            Err(_) => 30,
        };
        self.entries.push_back(Entry {
            toc: toc.to_vec(),
            until: now + Duration::from_secs(seconds),
            result,
        });
    }
    fn request(&self, toc: &[u32]) -> Result<Value, String> {
        let encoded = toc.iter().map(u32::to_string).collect::<Vec<_>>().join(" ");
        let mut response = self
            .agent
            .get("https://musicbrainz.org/ws/2/discid/-")
            .header(
                "User-Agent",
                concat!(
                    "Phemios/",
                    env!("CARGO_PKG_VERSION"),
                    " (https://github.com/craft-and-code/phemios)"
                ),
            )
            .header("Accept", "application/json")
            .query("toc", &encoded)
            .query("inc", "recordings+artist-credits")
            .query("cdstubs", "no")
            .query("fmt", "json")
            .call()
            .map_err(|_| "Identification MusicBrainz indisponible. La lecture reste disponible.")?;
        let bytes = response
            .body_mut()
            .with_config()
            .limit(LIMIT)
            .read_to_vec()
            .map_err(|_| "Réponse MusicBrainz trop grande ou interrompue.")?;
        let value = serde_json::from_slice(&bytes).map_err(|_| "Réponse MusicBrainz invalide.")?;
        parse::result(&value, toc)
    }
}
#[cfg(test)]
#[path = "cd_metadata_tests.rs"]
mod tests;
