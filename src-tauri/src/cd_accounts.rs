//! Framework-independent account admission for local optical audio; no disc or device access.
use std::sync::{Arc, Mutex, atomic::Ordering};
pub(crate) type Stamp = (
    Arc<Mutex<Option<phemios_core::network::Client>>>,
    Arc<std::sync::atomic::AtomicU64>,
    u64,
    Option<phemios_core::network::Client>,
);
/// Capture the native sources once for both policy checks and final audio admission.
pub(crate) fn capture(
    sources: impl IntoIterator<
        Item = (
            Arc<Mutex<Option<phemios_core::network::Client>>>,
            Arc<std::sync::atomic::AtomicU64>,
        ),
    >,
) -> Result<Vec<Stamp>, String> {
    sources
        .into_iter()
        .map(|(slot, generation)| {
            let client = slot
                .lock()
                .map_err(|_| "Session native indisponible.")?
                .clone();
            let ticket = generation.load(Ordering::SeqCst);
            Ok((slot, generation, ticket, client))
        })
        .collect()
}
// Recheck and hold only short-lived native session guards after policy I/O and before audio publication.
pub(crate) fn admit<T>(
    stamps: &[Stamp],
    work: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let guards = stamps
        .iter()
        .map(|(slot, _, _, _)| slot.lock().map_err(|_| "Session native indisponible."))
        .collect::<Result<Vec<_>, _>>()?;
    for ((_, generation, ticket, held), current) in stamps.iter().zip(&guards) {
        let same = match (held, current.as_ref()) {
            (None, None) => true,
            (Some(a), Some(b)) => a.same_session(b),
            _ => false,
        };
        if !same || generation.load(Ordering::SeqCst) != *ticket {
            return Err("Le compte a changé. Relancez la lecture du CD.".into());
        }
    }
    work()
}

// The anonymous source has no credentials; active accounts may not bypass supervision through it.
pub(crate) fn permission(owners: Vec<Stamp>) -> Box<dyn Fn() -> Result<(), String> + Send> {
    Box::new(move || {
        // Either source can replace an anonymous/unrestricted account during the other policy read.
        let current = || admit(&owners, || Ok(()));
        current()?;
        for (_, _, _, held) in &owners {
            if let Some(client) = held {
                if !matches!(
                    client.account()["account"]["role"].as_str(),
                    Some("admin" | "user")
                ) {
                    return Err("Votre compte ne permet pas la lecture.".into());
                }
                if client
                    .external_parental_status_admitted(current)?
                    .is_some_and(|s| s["policy"]["enabled"] == true)
                {
                    return Err("La lecture CD est indisponible pour un compte supervisé.".into());
                }
            }
        }
        current()
    })
}

#[cfg(test)]
#[path = "cd_accounts_tests.rs"]
mod tests;
