//! Account-bound parental status admission; no policy is inferred from public cached data.
use super::{Client, Value};

impl Client {
    /// Old servers expose no parental marker. New servers must return this owner's valid status.
    pub fn parental_status(&self) -> Result<Option<Value>, String> {
        if self.account["role"] == "admin" || !self.account["parental_enabled"].is_boolean() {
            return Ok(None);
        }
        let value = self.request("GET", "/api/me/v1/parental", &[], None)?;
        validate(&value, self.account["id"].as_str().unwrap_or_default())?;
        Ok(Some(value))
    }
    /// Recheck the live policy before serving a retained projection to a supervised account.
    pub fn admit_snapshot(&self, snapshot: &Value) -> Result<(), String> {
        if let Some(status) = self.parental_status()? {
            admit(
                &status,
                snapshot,
                self.account["id"].as_str().unwrap_or_default(),
            )?;
        }
        Ok(())
    }
    /// Admit retained images with at most one second of monotonic policy grace, shared only by clones of this login.
    ///
    /// This cache never admits audio, downloads, output changes or a freshly read catalog. Expired or
    /// failed reads fail closed; a failure is not retained. Network and cached images use the same
    /// projection validation, while native process generations still fence account replacements.
    pub fn admit_artwork_snapshot(&self, snapshot: &Value) -> Result<(), String> {
        if self.account["role"] == "admin" || !self.account["parental_enabled"].is_boolean() {
            return Ok(());
        }
        let mut cached = self
            .artwork_parental
            .lock()
            .map_err(|_| "État du contrôle parental indisponible.")?;
        if cached
            .as_ref()
            .is_some_and(|(checked, _)| checked.elapsed() >= std::time::Duration::from_secs(1))
        {
            *cached = None;
        }
        if cached.is_none() {
            // Start the bound before IO, so even a slow response cannot extend the grace period.
            let checked = std::time::Instant::now();
            if let Some(status) = self.parental_status()? {
                *cached = Some((checked, status));
            }
        }
        if let Some((_, status)) = cached.as_ref() {
            admit(
                status,
                snapshot,
                self.account["id"].as_str().unwrap_or_default(),
            )?;
        }
        Ok(())
    }
    /// Episode files cannot carry the account's continuous listening limits into another player.
    pub fn require_unrestricted_download(&self) -> Result<(), String> {
        if self
            .parental_status()?
            .is_some_and(|v| v["policy"]["enabled"] == true)
        {
            return Err(
                "Le téléchargement des épisodes est indisponible pour un compte supervisé.".into(),
            );
        }
        Ok(())
    }
    /// An external player cannot enforce this server's continuous listening limits.
    pub fn require_unrestricted_output(&self) -> Result<(), String> {
        if self
            .parental_status()?
            .is_some_and(|v| v["policy"]["enabled"] == true)
        {
            return Err("HQPlayer est indisponible pour un compte supervisé.".into());
        }
        Ok(())
    }
}

fn admit(status: &Value, snapshot: &Value, owner: &str) -> Result<(), String> {
    if status["policy"]["enabled"] == true
        && (snapshot["accountId"] != owner
            || snapshot["parentalEnabled"] != true
            || snapshot["parentalRevision"] != status["revision"]
            || snapshot["parentalPolicy"] != status["policy"])
    {
        return Err("Catalogue supervisé à actualiser. Synchronisez la bibliothèque.".into());
    }
    Ok(())
}
fn validate(value: &Value, owner: &str) -> Result<(), String> {
    if value["owner"] != owner
        || !value["policy"]["enabled"].is_boolean()
        || value["revision"].as_u64().is_none()
        || !value["allowed"].is_boolean()
    {
        return Err("État du contrôle parental invalide ou réservé à un autre compte.".into());
    }
    Ok(())
}
#[cfg(test)]
#[path = "network_parental_tests.rs"]
mod tests;
