//! Admission for deferred local-engine work, independent of Tauri and process/device IO.
use std::sync::Mutex;

#[derive(Default)]
pub(crate) struct Lifecycle(Mutex<u64>);
impl Lifecycle {
    /// Reserve order with the matching session capture/invalidation; admission performs no IO.
    pub(crate) fn begin<T>(
        &self,
        admission: impl FnOnce() -> Result<T, String>,
    ) -> Result<(u64, T), String> {
        let mut epoch = self
            .0
            .lock()
            .map_err(|_| "État du moteur local indisponible.")?;
        *epoch += 1;
        let value = admission()?;
        Ok((*epoch, value))
    }
    /// Check only after obtaining the resource, without holding lifecycle admission during IO.
    pub(crate) fn with_resource<T, R>(
        &self,
        resource: &Mutex<T>,
        ticket: u64,
        work: impl FnOnce(&mut T) -> Result<R, String>,
    ) -> Result<Option<R>, String> {
        let mut resource = resource
            .lock()
            .map_err(|_| "État du moteur local indisponible.")?;
        if *self
            .0
            .lock()
            .map_err(|_| "État du moteur local indisponible.")?
            != ticket
        {
            return Ok(None);
        }
        work(&mut resource).map(Some)
    }
    /// Final session publication is short and atomic with the next lifecycle reservation.
    pub(crate) fn publish<T>(
        &self,
        ticket: u64,
        work: impl FnOnce() -> Result<T, String>,
    ) -> Result<T, String> {
        let epoch = self
            .0
            .lock()
            .map_err(|_| "État du moteur local indisponible.")?;
        if *epoch != ticket {
            return Err("Démarrage local annulé.".into());
        }
        work()
    }
}

#[cfg(test)]
#[path = "local_lifecycle_tests.rs"]
mod tests;
