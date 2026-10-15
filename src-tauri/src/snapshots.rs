//! Session and retained-projection admission for native public catalog publication.
use phemios_core::{cache::Cache, network::Client};
use serde_json::Value;
use std::sync::{Arc, Mutex};

/// Share the native retained projection with its blocking publication worker.
pub(crate) type Snapshot = Arc<Mutex<Option<Arc<Value>>>>;

/// Fetch without holding state locks, then admit disk and memory publication to the same session.
pub(crate) fn synchronize(
    session: Arc<Mutex<Option<Client>>>,
    retained: Snapshot,
    cache: Cache,
    client: Client,
) -> Result<Value, String> {
    let next = client.snapshot()?;
    publish(&session, &retained, &cache, &client, next)
}

/// Read disk outside the mutex; an intervening native publication wins over this captured read.
/// The caller receives the retained current value if its disk result is already superseded.
pub(crate) fn load(cache: Cache, retained: Snapshot) -> Result<Option<Value>, String> {
    let captured = retained
        .lock()
        .map_err(|_| "Cache natif indisponible.".to_string())?
        .clone();
    let next = cache.load()?;
    publish_cached(&retained, &captured, next)
}

fn publish_cached(
    retained: &Mutex<Option<Arc<Value>>>,
    captured: &Option<Arc<Value>>,
    next: Option<Value>,
) -> Result<Option<Value>, String> {
    let current = {
        let mut retained = retained
            .lock()
            .map_err(|_| "Cache natif indisponible.".to_string())?;
        let unchanged = match (retained.as_ref(), captured.as_ref()) {
            (Some(current), Some(captured)) => Arc::ptr_eq(current, captured),
            (None, None) => true,
            _ => false,
        };
        if unchanged {
            *retained = next.map(Arc::new);
        }
        retained.clone()
    };
    // Clone response JSON after releasing the mutex; the captured Arc retains its coherent value.
    Ok(current.map(|value| value.as_ref().clone()))
}

fn publish(
    session: &Mutex<Option<Client>>,
    retained: &Mutex<Option<Arc<Value>>>,
    cache: &Cache,
    expected: &Client,
    next: Value,
) -> Result<Value, String> {
    let session = session
        .lock()
        .map_err(|_| "Session native indisponible.".to_string())?;
    if !session
        .as_ref()
        .is_some_and(|current| current.same_session(expected))
    {
        return Err("Synchronisation annulée : la session a changé.".into());
    }
    // Keep session admission locked through both publications, so logout/relogin cannot cross them.
    let mut retained = retained
        .lock()
        .map_err(|_| "Cache natif indisponible.".to_string())?;
    let next = if next["parentalEnabled"] == true {
        phemios_core::cache::validate(&next)?;
        next
    } else {
        cache.save(next)?
    };
    *retained = Some(Arc::new(next.clone()));
    Ok(next)
}

/// Previously cached images are not an authority to expose a now-hidden reference.
pub(crate) fn admit_artwork(
    client: &Client,
    snapshot: &Value,
    reference: &str,
) -> Result<(), String> {
    client.admit_artwork_snapshot(snapshot)?;
    if snapshot["parentalEnabled"] == true && !projection_contains(snapshot, reference) {
        return Err("Cette image est masquée par le contrôle parental.".into());
    }
    Ok(())
}
fn projection_contains(snapshot: &Value, reference: &str) -> bool {
    ["artists", "albums", "tracks"].iter().any(|kind| {
        snapshot[*kind]
            .as_array()
            .is_some_and(|rows| rows.iter().any(|row| row["reference"] == reference))
    })
}

#[cfg(test)]
#[path = "snapshots_tests.rs"]
mod tests;
