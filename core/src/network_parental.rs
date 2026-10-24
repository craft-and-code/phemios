//! Account-bound parental status admission; no policy is inferred from public cached data.
use super::{Client, Value};

impl Client {
    /// Old servers expose no parental marker. New servers must return this owner's valid status.
    pub fn parental_status(&self) -> Result<Option<Value>, String> {
        self.parental_status_admitted(|| Ok(()))
    }
    /// Policy lookups retire busy retries with their captured account admission.
    pub fn parental_status_admitted(
        &self,
        current: impl Fn() -> Result<(), String>,
    ) -> Result<Option<Value>, String> {
        current()?;
        if self.account["role"] == "admin" || !self.account["parental_enabled"].is_boolean() {
            return Ok(None);
        }
        let value = self.request_admitted("GET", "/api/me/v1/parental", &[], None, current)?;
        validate(&value, self.account["id"].as_str().unwrap_or_default())?;
        Ok(Some(value))
    }
    /// External media require fresh named authority before reusing an administrator or legacy exemption.
    /// Capable non-administrators already authenticate through their live owner-bound policy read.
    pub fn external_parental_status_admitted(
        &self,
        current: impl Fn() -> Result<(), String>,
    ) -> Result<Option<Value>, String> {
        current()?;
        if self.account["role"] != "admin" && self.account["parental_enabled"].is_boolean() {
            return self.parental_status_admitted(current);
        }
        let owner = self.account["id"]
            .as_str()
            .filter(|owner| !owner.is_empty())
            .ok_or("Session Aède invalide. Reconnectez-vous.")?;
        let role = self.account["role"]
            .as_str()
            .filter(|role| matches!(*role, "admin" | "user" | "auditor"))
            .ok_or("Session Aède invalide. Reconnectez-vous.")?;
        let live = self.request_admitted("GET", "/api/auth/v1/session", &[], None, &current)?;
        if live["id"] != owner || live["enabled"] != true || live["role"] != role {
            return Err("Session Aède remplacée, désactivée ou invalide. Reconnectez-vous.".into());
        }
        if live
            .get("parental_enabled")
            .is_some_and(|marker| !marker.is_boolean())
            || (self.account["parental_enabled"].is_boolean()
                && !live["parental_enabled"].is_boolean())
        {
            return Err("État du contrôle parental invalide.".into());
        }
        if role == "admin" || !live["parental_enabled"].is_boolean() {
            return Ok(None);
        }
        let value = self.request_admitted("GET", "/api/me/v1/parental", &[], None, current)?;
        validate(&value, owner)?;
        Ok(Some(value))
    }
    /// Recheck the live policy before serving a retained projection to a supervised account.
    pub fn admit_snapshot(&self, snapshot: &Value) -> Result<(), String> {
        self.admit_snapshot_admitted(snapshot, || Ok(()))
    }
    /// Retained projection checks share the caller's cancellable network admission.
    pub fn admit_snapshot_admitted(
        &self,
        snapshot: &Value,
        current: impl Fn() -> Result<(), String>,
    ) -> Result<(), String> {
        if let Some(status) = self.parental_status_admitted(current)? {
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
        self.admit_artwork_snapshot_admitted(snapshot, || Ok(()))
    }
    /// Native session admission remains independent of the one-second policy cache.
    pub fn admit_artwork_snapshot_admitted(
        &self,
        snapshot: &Value,
        current: impl Fn() -> Result<(), String>,
    ) -> Result<(), String> {
        current()?;
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
            if let Some(status) = self.parental_status_admitted(&current)? {
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
        self.require_unrestricted_download_admitted(|| Ok(()))
    }
    /// Retire the policy lookup before another account or cancelled transfer can dispatch a retry.
    pub fn require_unrestricted_download_admitted(
        &self,
        current: impl Fn() -> Result<(), String>,
    ) -> Result<(), String> {
        if self
            .external_parental_status_admitted(current)?
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
        self.require_unrestricted_output_admitted(|| Ok(()))
    }
    /// Output preparation retains its caller's cancellation and native session admission.
    pub fn require_unrestricted_output_admitted(
        &self,
        current: impl Fn() -> Result<(), String>,
    ) -> Result<(), String> {
        if self
            .external_parental_status_admitted(current)?
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
