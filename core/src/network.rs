//! Bounded HTTP client for one explicit Aède authority; sessions stay in memory.
use serde_json::{Value, json};
use std::time::Duration;
#[path = "network_errors.rs"]
mod errors;
#[path = "network_snapshot.rs"]
mod snapshot;

const JSON_LIMIT: u64 = 16 * 1024 * 1024;
/// Trusted native session; never serialize or log this value.
#[derive(Clone)]
pub struct Client {
    agent: ureq::Agent,
    server: String,
    token: String,
    account: Value,
}
/// Reject insecure remote login, URL credentials, redirects and embedded queries.
pub fn server_address(value: &str) -> Result<String, String> {
    let value = value.trim().trim_end_matches('/');
    let uri: value_uri::Uri = value.parse().map_err(|_| "Adresse de serveur invalide.")?;
    let authority = uri.authority().ok_or("Adresse de serveur invalide.")?;
    let host = uri.host().ok_or("Adresse de serveur invalide.")?;
    let scheme = uri.scheme_str().ok_or("Adresse de serveur invalide.")?;
    if authority.as_str().contains('@')
        || uri.query().is_some()
        || uri.path() != "/"
        || value.contains('#')
        || !matches!(scheme, "http" | "https")
    {
        return Err(
            "Utilisez une adresse HTTP/HTTPS sans identifiants, chemin ni paramètres.".into(),
        );
    }
    let loopback = host == "localhost"
        || host == "[::1]"
        || host
            .parse::<std::net::IpAddr>()
            .is_ok_and(|address| address.is_loopback());
    if scheme == "http" && !loopback {
        return Err("Un serveur distant nécessite HTTPS.".into());
    }
    Ok(value.into())
}
// Reuse the HTTP parser shipped by ureq rather than a second URL parser.
mod value_uri {
    pub use ureq::http::Uri;
}
fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(30)))
        .max_redirects(0)
        .http_status_as_error(false)
        .build()
        .into()
}
fn failure(status: u16) -> String {
    match status {
        401 => "Session absente ou expirée. Reconnectez-vous.",
        403 => "Votre compte ne permet pas cette opération.",
        404 => "Service ou ressource indisponible sur ce serveur.",
        409 => "Les données ont changé ou sont occupées. Réessayez.",
        429 | 503 => "Aède est occupé. Réessayez dans quelques instants.",
        _ => "La requête Aède a échoué.",
    }
    .into()
}
fn bytes(mut response: ureq::http::Response<ureq::Body>, limit: u64) -> Result<Vec<u8>, String> {
    let status = response.status().as_u16();
    if !(200..300).contains(&status) {
        return Err(failure(status));
    }
    response
        .body_mut()
        .with_config()
        .limit(limit)
        .read_to_vec()
        .map_err(|_| "Réponse Aède trop grande ou interrompue.".into())
}
fn decode(data: &[u8]) -> Result<Value, String> {
    if data.is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_slice(data).map_err(|_| "Réponse JSON Aède invalide.".into())
}
impl Client {
    pub(crate) fn playback_credentials(&self) -> (&str, &str) {
        (&self.server, &self.token)
    }
    /// Authenticate only against the selected authority. Passwords are not retained.
    pub fn login(server: &str, username: &str, password: &str) -> Result<Self, String> {
        let server = server_address(server)?;
        if username.trim().is_empty()
            || username.len() > 128
            || password.is_empty()
            || password.len() > 1024
        {
            return Err("Identifiants invalides.".into());
        }
        let agent = agent();
        let data = json!({"username":username,"password":password}).to_string();
        let response = agent
            .post(format!("{server}/api/auth/v1/session"))
            .header("Content-Type", "application/json")
            .send(data.as_bytes())
            .map_err(|_| "Impossible de joindre Aède.".to_string())?;
        let answer = decode(&bytes(response, 64 * 1024)?)?;
        let token = answer["token"]
            .as_str()
            .filter(|value| value.len() == 64 && value.bytes().all(|b| b.is_ascii_hexdigit()))
            .ok_or("Session Aède invalide.")?
            .to_owned();
        let account = answer["account"].clone();
        if !account.is_object() || account["id"].as_str().is_none() {
            return Err("Compte Aède invalide.".into());
        }
        Ok(Self {
            agent,
            server,
            token,
            account,
        })
    }
    /// Compare native session identity without exposing its bearer credential.
    pub fn same_session(&self, other: &Self) -> bool {
        self.server == other.server && self.token == other.token
    }
    /// Public account metadata excludes the bearer credential.
    pub fn account(&self) -> Value {
        json!({"account":self.account,"server":self.server})
    }
    /// Explicit supported JSON operations; never accept a second authority or arbitrary URL.
    pub fn request(
        &self,
        method: &str,
        path: &str,
        query: &[(&str, &str)],
        body: Option<&Value>,
    ) -> Result<Value, String> {
        if !allowed(method, path) {
            return Err("Opération native non prise en charge.".into());
        }
        let url = format!("{}{}", self.server, path);
        let response = if method == "GET" {
            read_response(|| {
                let mut request = self
                    .agent
                    .get(&url)
                    .header("Authorization", format!("Bearer {}", self.token));
                for (key, value) in query {
                    request = request.query(key, value);
                }
                request.call()
            })
        } else if method == "DELETE" {
            let mut request = self
                .agent
                .delete(&url)
                .header("Authorization", format!("Bearer {}", self.token));
            for (key, value) in query {
                request = request.query(key, value);
            }
            if path == "/api/me/v1/history" {
                let data = body.unwrap_or(&Value::Null).to_string();
                if data.len() > 1024 {
                    return Err("Confirmation trop grande.".into());
                }
                request
                    .force_send_body()
                    .header("Content-Type", "application/json")
                    .send(data.as_bytes())
            } else {
                request.call()
            }
        } else {
            let data = body.unwrap_or(&Value::Null).to_string();
            if data.len() > 16 * 1024 {
                return Err("Requête trop grande.".into());
            }
            let mut request = if method == "PATCH" {
                self.agent.patch(&url)
            } else if method == "PUT" {
                self.agent.put(&url)
            } else {
                self.agent.post(&url)
            };
            request = request
                .header("Authorization", format!("Bearer {}", self.token))
                .header("Content-Type", "application/json");
            for (key, value) in query {
                request = request.query(key, value);
            }
            request.send(data.as_bytes())
        }
        .map_err(|_| "Impossible de joindre Aède.".to_string())?;
        if !response.status().is_success() {
            let status = response.status().as_u16();
            let mut response = response;
            let detail = response
                .body_mut()
                .with_config()
                .limit(8192)
                .read_to_vec()
                .ok()
                .and_then(|bytes| serde_json::from_slice(&bytes).ok());
            return Err(errors::request_failure(
                status,
                method,
                path,
                body.is_some_and(|v| v["create_only"] == true),
                detail.as_ref(),
            ));
        }
        decode(&bytes(response, JSON_LIMIT)?)
    }
    /// Fetch only catalog-selected local artwork, never an external image URL.
    pub fn artwork(&self, reference: &str, kind: &str) -> Result<Vec<u8>, String> {
        if reference.len() > 16 * 1024
            || !matches!(
                kind,
                "cover" | "banner" | "background" | "portrait" | "spectrum"
            )
        {
            return Err("Image non prise en charge.".into());
        }
        let size = if matches!(kind, "cover" | "portrait") {
            "512"
        } else {
            "1920"
        };
        self.read_artwork(reference, kind, Some(size))
    }
    /// Read an unowned group's cached cover or explicitly request archive acquisition on Aède.
    pub fn missing_cover(
        &self,
        artist: &str,
        group: &str,
        download: bool,
    ) -> Result<Vec<u8>, String> {
        if !artist.starts_with("artist:")
            || artist.len() > 4096
            || group.len() != 36
            || !group.bytes().enumerate().all(|(i, b)| {
                if [8, 13, 18, 23].contains(&i) {
                    b == b'-'
                } else {
                    b.is_ascii_hexdigit()
                }
            })
        {
            return Err("Album manquant Aède invalide.".into());
        }
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(60)))
            .max_redirects(0)
            .http_status_as_error(false)
            .build()
            .into();
        let url = format!("{}/api/me/v1/missing/cover", self.server);
        let response = if download {
            agent
                .post(url)
                .query("artist", artist)
                .query("release_group", group)
                .header("Authorization", format!("Bearer {}", self.token))
                .send_empty()
        } else {
            agent
                .get(url)
                .query("artist", artist)
                .query("release_group", group)
                .header("Authorization", format!("Bearer {}", self.token))
                .call()
        }
        .map_err(|_| "Image Aède inaccessible.".to_string())?;
        let data = bytes(response, 32 * 1024 * 1024)?;
        if !data.is_empty()
            && !data.starts_with(&[0xff, 0xd8, 0xff])
            && !data.starts_with(b"\x89PNG\r\n\x1a\n")
        {
            return Err("Format d’image Aède invalide.".into());
        }
        Ok(data)
    }
    /// Export a retained track spectrum at its original dimensions, without thumbnail rendering.
    pub fn spectrum_download(&self, reference: &str) -> Result<Vec<u8>, String> {
        if !reference.starts_with("track:") || reference.len() > 4096 {
            return Err("Référence de spectre invalide.".into());
        }
        self.read_artwork(reference, "spectrum", None)
    }
    fn read_artwork(
        &self,
        reference: &str,
        kind: &str,
        size: Option<&str>,
    ) -> Result<Vec<u8>, String> {
        let response = read_response(|| {
            let mut request = self
                .agent
                .get(format!("{}/api/v1/artwork", self.server))
                .query("ref", reference)
                .query("kind", kind);
            if let Some(size) = size {
                request = request.query("size", size);
            }
            request
                .header("Authorization", format!("Bearer {}", self.token))
                .call()
        })
        .map_err(|_| "Image Aède inaccessible.".to_string())?;
        let data = bytes(response, 32 * 1024 * 1024)?;
        if !data.starts_with(&[0xff, 0xd8, 0xff]) && !data.starts_with(b"\x89PNG\r\n\x1a\n") {
            return Err("Format d’image Aède invalide.".into());
        }
        Ok(data)
    }
}
// Only idempotent GET operations enter this retry boundary; writes are never replayed.
fn read_response(
    call: impl Fn() -> Result<ureq::http::Response<ureq::Body>, ureq::Error>,
) -> Result<ureq::http::Response<ureq::Body>, ureq::Error> {
    for attempt in 0..4 {
        let response = call()?;
        if !matches!(response.status().as_u16(), 409 | 429 | 503) {
            return Ok(response);
        }
        drop(response);
        std::thread::sleep(Duration::from_millis(150 << attempt));
    }
    call()
}
fn allowed(method: &str, path: &str) -> bool {
    match method {
        "GET" => {
            matches!(
                path,
                "/api/auth/v1/session"
                    | "/api/v1/status"
                    | "/api/v1/roots"
                    | "/api/admin/v1/accounts"
                    | "/api/admin/v1/tasks"
                    | "/api/v1/presentation/tracks"
                    | "/api/v1/presentation/analysis"
                    | "/api/v1/presentation/artists"
                    | "/api/v1/presentation/albums"
                    | "/api/v1/presentation/playback"
                    | "/api/v1/stats"
                    | "/api/v1/doctor"
                    | "/api/v1/analysis/report"
                    | "/api/v1/album"
                    | "/api/v1/artist"
                    | "/api/v1/track"
                    | "/api/v1/lyrics"
                    | "/api/v1/waveform"
                    | "/api/v1/query"
                    | "/api/v1/labels"
                    | "/api/v1/label"
                    | "/api/me/v1/missing"
                    | "/api/me/v1/annotation"
                    | "/api/me/v1/annotations"
                    | "/api/me/v1/preferences"
                    | "/api/me/v1/moods"
                    | "/api/me/v1/m3u"
                    | "/api/me/v1/m3u-files"
                    | "/api/me/v1/collections"
                    | "/api/me/v1/collection"
                    | "/api/me/v1/collection/albums"
                    | "/api/me/v1/search"
                    | "/api/me/v1/achievements"
                    | "/api/me/v1/history"
            ) || task_path(path, false)
                || playlist_path(path)
                || library_playlist_path(path)
                || account_path(path, false)
        }
        "PUT" => matches!(
            path,
            "/api/me/v1/annotation"
                | "/api/me/v1/moods"
                | "/api/me/v1/collection"
                | "/api/auth/v1/password"
                | "/api/me/v1/missing"
        ),
        "PATCH" => {
            path == "/api/me/v1/collection"
                || path == "/api/me/v1/preferences"
                || account_path(path, false)
        }
        "DELETE" => {
            account_path(path, true)
                || matches!(
                    path,
                    "/api/auth/v1/session" | "/api/me/v1/collection" | "/api/me/v1/history"
                )
        }
        "POST" => {
            matches!(
                path,
                "/api/me/v1/achievements"
                    | "/api/admin/v1/analyze"
                    | "/api/admin/v1/spectrum"
                    | "/api/me/v1/m3u"
                    | "/api/admin/v1/scan"
                    | "/api/admin/v1/fetch"
                    | "/api/admin/v1/lyrics"
                    | "/api/admin/v1/accounts"
            ) || task_path(path, true)
        }
        _ => false,
    }
}
fn task_path(path: &str, cancel: bool) -> bool {
    let Some(id) = path.strip_prefix("/api/admin/v1/tasks/") else {
        return false;
    };
    let id = if cancel {
        match id.strip_suffix("/cancel") {
            Some(id) => id,
            None => return false,
        }
    } else {
        id
    };
    !id.is_empty() && id.len() <= 20 && id.bytes().all(|b| b.is_ascii_digit())
}

#[cfg(test)]
#[path = "network_tests.rs"]
mod tests;

fn playlist_path(path: &str) -> bool {
    path.strip_prefix("/api/me/v1/m3u/playlist-")
        .is_some_and(|id| id.len() == 64 && id.bytes().all(|b| b.is_ascii_hexdigit()))
}

fn account_path(path: &str, sessions: bool) -> bool {
    let Some(name) = path.strip_prefix("/api/admin/v1/accounts/") else {
        return false;
    };
    let name = if sessions {
        match name.strip_suffix("/sessions") {
            Some(name) => name,
            None => return false,
        }
    } else {
        name
    };
    !name.is_empty()
        && name.len() <= 128
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'))
}

#[cfg(test)]
#[path = "network_test_support.rs"]
pub(crate) mod test_support;

fn library_playlist_path(path: &str) -> bool {
    path.strip_prefix("/api/me/v1/m3u-files/m3u-file-")
        .is_some_and(|id| id.len() == 64 && id.bytes().all(|b| b.is_ascii_hexdigit()))
}
