//! Apple sharing links resolve only through the fixed public iTunes lookup endpoint.
use super::{FeedClient, feed_address};
use serde_json::Value;
use url::Url;

fn lookup_address(value: &str) -> Result<(u64, String), String> {
    feed_address(value)?;
    let url = Url::parse(value).map_err(|_| "Lien Apple Podcasts invalide.")?;
    if url.scheme() != "https"
        || url.host_str() != Some("podcasts.apple.com")
        || url.port().is_some_and(|port| port != 443)
    {
        return Err("Utilisez un lien HTTPS de podcasts.apple.com.".into());
    }
    let parts: Vec<_> = url.path_segments().into_iter().flatten().collect();
    let country = parts
        .first()
        .filter(|part| part.len() == 2 && part.bytes().all(|c| c.is_ascii_alphabetic()));
    let first = usize::from(country.is_some());
    if parts.get(first) != Some(&"podcast") {
        return Err("Ce lien n’identifie pas un podcast Apple.".into());
    }
    let id = parts
        .last()
        .and_then(|part| part.strip_prefix("id"))
        .filter(|id| !id.is_empty() && id.bytes().all(|c| c.is_ascii_digit()))
        .and_then(|id| id.parse::<u64>().ok())
        .filter(|id| *id > 0)
        .ok_or("Ce lien n’identifie pas un podcast Apple.")?;
    let mut lookup = format!("https://itunes.apple.com/lookup?id={id}&entity=podcast");
    if let Some(country) = country {
        lookup.push_str(&format!("&country={}", country.to_ascii_lowercase()));
    }
    Ok((id, lookup))
}

fn resolved_feed(bytes: &[u8], id: u64) -> Result<String, String> {
    let data: Value =
        serde_json::from_slice(bytes).map_err(|_| "Réponse Apple Podcasts invalide.")?;
    let rows = data
        .get("results")
        .and_then(Value::as_array)
        .ok_or("Réponse Apple Podcasts invalide.")?;
    let matches: Vec<_> = rows
        .iter()
        .filter(|row| {
            row.get("kind").and_then(Value::as_str) == Some("podcast")
                && row.get("collectionId").and_then(Value::as_u64) == Some(id)
                && row.get("trackId").and_then(Value::as_u64) == Some(id)
        })
        .collect();
    if matches.len() != 1 {
        return Err("Flux RSS introuvable pour ce podcast Apple.".into());
    }
    let feed = matches[0]
        .get("feedUrl")
        .and_then(Value::as_str)
        .ok_or("Ce podcast Apple ne fournit pas de flux RSS public.")?;
    feed_address(feed)?;
    Ok(feed.to_owned())
}

impl FeedClient {
    /// Resolve an explicit Apple show/episode share to public RSS, without following its web page.
    /// The same public-address/DNS guards and request deadline apply as for ordinary RSS.
    pub fn resolve_apple(&self, url: &str) -> Result<String, String> {
        let (id, lookup) = lookup_address(url)?;
        let mut response = self
            .agent
            .get(lookup)
            .header(
                "User-Agent",
                concat!(
                    "Phemios/",
                    env!("CARGO_PKG_VERSION"),
                    " (Podcast RSS client)"
                ),
            )
            .header("Accept", "application/json")
            .call()
            .map_err(|_| "Apple Podcasts indisponible. Réessayez ou utilisez le flux RSS.")?;
        let bytes = response
            .body_mut()
            .with_config()
            .limit(1024 * 1024)
            .read_to_vec()
            .map_err(|_| "Réponse Apple Podcasts trop grande ou interrompue.")?;
        resolved_feed(&bytes, id)
    }
}
#[cfg(test)]
#[path = "podcast_apple_tests.rs"]
mod tests;
