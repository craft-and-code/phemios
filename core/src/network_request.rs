//! Supported JSON transport and cancellable idempotent retry admission.
use super::*;
impl Client {
    /// Explicit supported JSON operations; never accept a second authority or arbitrary URL.
    pub fn request(
        &self,
        method: &str,
        path: &str,
        query: &[(&str, &str)],
        body: Option<&Value>,
    ) -> Result<Value, String> {
        self.request_admitted(method, path, query, body, || Ok(()))
    }
    /// Check admission before/after every HTTP attempt; only GET may retry busy responses.
    /// Mutation bodies, bounded diagnostics and the original authority remain unchanged.
    pub fn request_admitted(
        &self,
        method: &str,
        path: &str,
        query: &[(&str, &str)],
        body: Option<&Value>,
        current: impl Fn() -> Result<(), String>,
    ) -> Result<Value, String> {
        current()?;
        if !allowed(method, path) {
            return Err("Opération native non prise en charge.".into());
        }
        let url = format!("{}{}", self.server, path);
        let response = if method == "GET" {
            read_response(
                || {
                    let mut request = self
                        .agent
                        .get(&url)
                        .header("Authorization", format!("Bearer {}", self.token));
                    for (key, value) in query {
                        request = request.query(key, value);
                    }
                    request
                        .call()
                        .map_err(|_| "Impossible de joindre Aède.".to_string())
                },
                &current,
            )
        } else if method == "DELETE" {
            let mut request = self
                .agent
                .delete(&url)
                .header("Authorization", format!("Bearer {}", self.token));
            for (key, value) in query {
                request = request.query(key, value);
            }
            (if path == "/api/me/v1/history" {
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
            })
            .map_err(|_| "Impossible de joindre Aède.".to_string())
        } else {
            // Absence is an empty HTTP body, never JSON null (notably task Stop).
            let data = body.map(Value::to_string).unwrap_or_default();
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
            request
                .send(data.as_bytes())
                .map_err(|_| "Impossible de joindre Aède.".to_string())
        }?;
        current()?;
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
            current()?;
            return Err(errors::request_failure(
                status,
                method,
                path,
                body.is_some_and(|v| v["create_only"] == true),
                detail.as_ref(),
            ));
        }
        let result = decode(&bytes(response, JSON_LIMIT)?);
        current()?;
        result
    }
}

/// Keep retry admission generic so artwork can retain its own transport diagnostics.
pub(super) fn read_response<E>(
    call: impl Fn() -> Result<ureq::http::Response<ureq::Body>, E>,
    current: impl Fn() -> Result<(), E>,
) -> Result<ureq::http::Response<ureq::Body>, E> {
    for attempt in 0..4 {
        current()?;
        let response = call();
        current()?;
        let response = response?;
        if !matches!(response.status().as_u16(), 409 | 429 | 503) {
            return Ok(response);
        }
        drop(response);
        std::thread::sleep(Duration::from_millis(150 << attempt));
    }
    current()?;
    let response = call();
    current()?;
    response
}

#[cfg(test)]
#[path = "network_request_test_support.rs"]
mod test_support;
#[cfg(test)]
#[path = "network_request_tests.rs"]
mod tests;
