//! Exact native-session admission at asynchronous work and login publication boundaries.
use phemios_core::network::Client;
use serde_json::Value;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

/// Invalidate pending logins even when no authenticated client has been published yet.
pub(crate) fn invalidate(
    session: &Mutex<Option<Client>>,
    generation: &AtomicU64,
) -> Result<Option<Client>, String> {
    let mut session = session.lock().map_err(|_| "Session native indisponible.")?;
    generation.fetch_add(1, Ordering::SeqCst);
    Ok(session.take())
}

/// Restore process-owned public identity after a webview reload, without issuing or exposing credentials.
/// The session mutex keeps the metadata and opaque generation ticket in one snapshot.
pub(crate) fn current(
    session: &Mutex<Option<Client>>,
    generation: &AtomicU64,
) -> Result<Option<Value>, String> {
    let session = session.lock().map_err(|_| "Session native indisponible.")?;
    let Some(client) = session.as_ref() else {
        return Ok(None);
    };
    let mut account = client.account();
    account["nativeSession"] = generation.load(Ordering::SeqCst).to_string().into();
    Ok(Some(account))
}

/// Install a finished login only inside the generation that requested it.
pub(crate) fn publish_login(
    session: &Mutex<Option<Client>>,
    generation: &AtomicU64,
    expected: u64,
    client: Client,
    replace: bool,
) -> Result<Value, String> {
    let mut session = session.lock().map_err(|_| "Session native indisponible.")?;
    if generation.load(Ordering::SeqCst) != expected {
        return Err("Connexion annulée : la session a changé.".into());
    }
    if !replace && session.is_some() {
        return Err("Déconnectez la session active avant de changer de compte.".into());
    }
    let mut account = client.account();
    *session = Some(client);
    let next = generation.fetch_add(1, Ordering::SeqCst) + 1;
    account["nativeSession"] = next.to_string().into();
    Ok(account)
}

/// Remote authentication already allocated a bearer token before native publication.
/// Retire only that rejected client; never invalidate a successor native session.
/// Call from a blocking worker because release may perform the remote logout request.
pub(crate) fn publish_remote_login(
    session: &Mutex<Option<Client>>,
    generation: &AtomicU64,
    expected: u64,
    client: Client,
    release: impl FnOnce(&Client) -> Result<(), String>,
) -> Result<Value, String> {
    match publish_login(session, generation, expected, client.clone(), false) {
        Ok(account) => Ok(account),
        Err(publication) => match release(&client) {
            Ok(()) => Err(publication),
            Err(revocation) => Err(format!("{publication}\n{revocation}")),
        },
    }
}

/// Dispatch captured work once; stale queued clients and late private replies are refused.
pub(crate) fn dispatch<T>(
    session: &Mutex<Option<Client>>,
    expected: &Client,
    work: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    confirm(session, expected)?;
    let result = work();
    confirm(session, expected)?;
    result
}

/// Keep bounded private-file IO inside exact client and IPC-generation admission.
pub(crate) fn with_current<T>(
    session: &Mutex<Option<Client>>,
    generation: &AtomicU64,
    ticket: &str,
    expected: &Client,
    work: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let current = session.lock().map_err(|_| "Session native indisponible.")?;
    if generation.load(Ordering::SeqCst).to_string() != ticket
        || !current
            .as_ref()
            .is_some_and(|value| value.same_session(expected))
    {
        return Err("Session remplacée ou déconnectée. Reconnectez-vous.".into());
    }
    work()
}

/// Admit a captured opaque process ticket before and after native work; this is not authentication.
pub(crate) fn scoped_dispatch<T>(
    session: &Mutex<Option<Client>>,
    generation: &AtomicU64,
    ticket: Option<&str>,
    expected: &Client,
    work: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    if let Some(ticket) = ticket {
        with_current(session, generation, ticket, expected, || Ok(()))?;
    }
    let result = dispatch(session, expected, work);
    if let Some(ticket) = ticket {
        with_current(session, generation, ticket, expected, || Ok(()))?;
    }
    result
}
/// Keep bounded cache IO inside the captured process generation, including an unauthenticated view.
pub(crate) fn with_generation<T>(
    session: &Mutex<Option<Client>>,
    generation: &AtomicU64,
    expected: u64,
    work: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let _session = session.lock().map_err(|_| "Session native indisponible.")?;
    if generation.load(Ordering::SeqCst) != expected {
        return Err("Session remplacée ou déconnectée. Reconnectez-vous.".into());
    }
    work()
}

/// Refuse queued or late artwork replies even when the captured view had no authenticated client.
pub(crate) fn generation_dispatch<T>(
    session: &Mutex<Option<Client>>,
    generation: &AtomicU64,
    expected: u64,
    work: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    with_generation(session, generation, expected, || Ok(()))?;
    let result = work();
    with_generation(session, generation, expected, || result)
}

/// Check live server permissions outside locks, then admit bounded private-file mutation atomically.
pub(crate) fn private_write<T>(
    session: &Mutex<Option<Client>>,
    generation: &AtomicU64,
    ticket: &str,
    expected: &Client,
    work: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    scoped_dispatch(session, generation, Some(ticket), expected, || {
        let current =
            expected.request_admitted("GET", "/api/auth/v1/session", &[], None, || {
                with_current(session, generation, ticket, expected, || Ok(()))
            })?;
        if current["id"] != expected.account()["account"]["id"]
            || current["enabled"] != true
            || !matches!(current["role"].as_str(), Some("user" | "admin"))
        {
            return Err("Ce compte ne peut pas modifier ses données personnelles.".into());
        }
        with_current(session, generation, ticket, expected, work)
    })
}

fn confirm(session: &Mutex<Option<Client>>, expected: &Client) -> Result<(), String> {
    if !session
        .lock()
        .map_err(|_| "Session native indisponible.")?
        .as_ref()
        .is_some_and(|current| current.same_session(expected))
    {
        return Err("Session remplacée ou déconnectée. Reconnectez-vous.".into());
    }
    Ok(())
}

#[cfg(test)]
#[path = "sessions_tests.rs"]
mod tests;
