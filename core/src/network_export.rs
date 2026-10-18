//! Account-authorized original streaming into native-owned private staging.
use super::*;
impl Client {
    /// Explicit bounded original export; binary bodies never cross the webview.
    pub fn export_original(
        &self,
        reference: &str,
        stamp: &str,
        expected: u64,
        path: &std::path::Path,
        valid: &dyn Fn() -> Result<(), String>,
        progress: &dyn Fn(u64),
    ) -> Result<(), String> {
        use std::io::{Read, Write};
        if !reference.starts_with("track:")
            || reference.len() > 4096
            || stamp.len() > 128
            || expected == 0
            || expected > 64 * 1024 * 1024 * 1024
        {
            return Err("Original audio invalide ou trop volumineux.".into());
        }
        valid()?;
        self.require_unrestricted_download()?;
        let mut response = self
            .agent
            .get(format!("{}/api/me/v1/exports/original", self.server))
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Accept-Encoding", "identity")
            .query("ref", reference)
            .query("stamp", stamp)
            .config()
            .timeout_global(Some(std::time::Duration::from_secs(3600)))
            .timeout_resolve(Some(std::time::Duration::from_secs(15)))
            .timeout_connect(Some(std::time::Duration::from_secs(15)))
            // Ureq carries the preceding stage budget forward: SendRequest bounds
            // header reception, whereas RecvResponse would cap the whole body.
            .timeout_send_request(Some(std::time::Duration::from_secs(15)))
            .timeout_recv_response(None)
            .timeout_recv_body(Some(std::time::Duration::from_secs(15)))
            .build()
            .call()
            .map_err(|_| "Téléchargement de l’original interrompu.")?;
        if response.status() != ureq::http::StatusCode::OK
            || response
                .headers()
                .get("content-length")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok())
                != Some(expected)
            || response
                .headers()
                .get("content-encoding")
                .is_some_and(|v| v != "identity")
        {
            return Err("Original indisponible, modifié ou export non autorisé. Actualisez Aède et réessayez.".into());
        }
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(path)
            .map_err(|_| "Fichier temporaire indisponible.")?;
        let mut reader = response.body_mut().as_reader();
        let mut buffer = vec![0; 64 * 1024];
        let mut count = 0u64;
        loop {
            valid()?;
            let n = reader
                .read(&mut buffer)
                .map_err(|_| "Téléchargement de l’original interrompu.")?;
            if n == 0 {
                break;
            }
            count = count
                .checked_add(n as u64)
                .ok_or("Original trop volumineux.")?;
            if count > expected {
                return Err("L’original dépasse sa taille annoncée.".into());
            }
            file.write_all(&buffer[..n])
                .map_err(|_| "Espace temporaire insuffisant ou écriture impossible.")?;
            progress(count);
        }
        if count != expected {
            return Err("L’original téléchargé est incomplet.".into());
        }
        file.sync_all()
            .map_err(|_| "Écriture temporaire impossible.")?;
        valid()
    }
}
#[cfg(test)]
#[path = "network_export_tests.rs"]
mod tests;
