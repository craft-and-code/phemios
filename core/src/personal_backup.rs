//! Explicit, additive portable restoration for the current native principal only.
use crate::{article_store, federation::Source, network::Client, podcast_store};
use serde_json::{Value, json};
const LIMIT: usize = 12 * 1024 * 1024;
fn fields(value: &Value, allowed: &[&str]) -> Result<(), String> {
    let object = value
        .as_object()
        .ok_or("Sauvegarde des préférences invalide.")?;
    if object.len() != allowed.len() || object.keys().any(|key| !allowed.contains(&key.as_str())) {
        return Err("Sauvegarde des préférences invalide.".into());
    }
    Ok(())
}
fn text(value: &Value, max: usize) -> bool {
    value.as_str().is_some_and(|s| {
        !s.trim().is_empty() && s.encode_utf16().count() <= max && !s.chars().any(char::is_control)
    })
}
/// Attribution is bounded metadata, never authority for choosing a destination account.
pub fn validate(payload: &Value) -> Result<(), String> {
    fields(payload, &["origin", "podcasts", "articles"])?;
    let origin = &payload["origin"];
    fields(origin, &["source", "authority", "accountId", "name"])?;
    if !matches!(origin["source"].as_str(), Some("local" | "server"))
        || !text(&origin["authority"], 4096)
        || !text(&origin["accountId"], 256)
        || !text(&origin["name"], 256)
        || (origin["source"] == "local" && origin["authority"] != "phemios-managed-local")
    {
        return Err("Sauvegarde des préférences invalide.".into());
    }
    fields(&payload["podcasts"], &["feeds", "episodes"])?;
    podcast_store::validate(&payload["podcasts"])?;
    article_store::validate(&json!({"articles":payload["articles"]}))?;
    if serde_json::to_vec(payload)
        .map_err(|_| "Sauvegarde des préférences invalide.")?
        .len()
        > LIMIT
    {
        return Err("Sauvegarde des préférences invalide.".into());
    }
    Ok(())
}
/// Both stores must be readable; never export an empty substitute for unreadable private data.
pub fn read(
    podcasts: &podcast_store::Store,
    articles: &article_store::Store,
    source: Source,
    client: &Client,
) -> Result<Value, String> {
    let account = client.account();
    let id = account["account"]["id"]
        .as_str()
        .ok_or("Compte privé invalide.")?;
    let name = account["account"]["username"].as_str().unwrap_or(id);
    let authority = if source == Source::Local {
        "phemios-managed-local"
    } else {
        account["server"].as_str().ok_or("Compte privé invalide.")?
    };
    let podcast = podcasts.read(source, client)?;
    let article = articles.read(source, client)?;
    let value = json!({"origin":{"source":source.name(),"authority":authority,"accountId":id,"name":name},"podcasts":podcast,"articles":article["articles"]});
    validate(&value)?;
    Ok(value)
}
/// Validate both retained stores and combined quotas before publishing anything. Imports add missing
/// identities only; existing subscriptions/editions/evidence win. Files publish independently, so
/// an IO failure after the first publication may leave safe additions; retry is idempotent.
pub fn restore(
    podcasts: &podcast_store::Store,
    articles: &article_store::Store,
    source: Source,
    client: &Client,
    payload: &Value,
) -> Result<(), String> {
    validate(payload)?;
    let podcast = podcasts.prepare_restore(source, client, &payload["podcasts"])?;
    let article =
        articles.prepare_restore(source, client, &json!({"articles":payload["articles"]}))?;
    podcasts.commit_restore(source, client, podcast)?;
    articles.commit_restore(source,client,article).map_err(|_| "Restauration interrompue. Les données existantes sont conservées ; réessayez l’import pour terminer.".to_owned())
}
#[cfg(test)]
#[path = "personal_backup_tests.rs"]
mod tests;
