//! Framework-independent HQPlayer routing state; protocol/device IO remains in phemios-core.
use phemios_core::hqplayer::Controller;
use serde_json::{Value, json};
use std::sync::{Arc, Mutex, atomic::Ordering};
#[derive(Clone)]
pub(crate) struct HqPlayer {
    pub controller: Arc<Controller>,
    mappings: Arc<Mutex<Value>>,
    pub routing: Arc<Mutex<()>>,
    epoch: Arc<std::sync::atomic::AtomicU64>,
    sequence: Arc<std::sync::atomic::AtomicU64>,
    // Accepted catalogue/CD output, distinct from preparation/cancellation requests.
    pub published_epoch: Arc<std::sync::atomic::AtomicU64>,
    configuration: Arc<std::sync::atomic::AtomicU64>,
    configured: Arc<std::sync::atomic::AtomicU64>,
}
impl Default for HqPlayer {
    fn default() -> Self {
        Self {
            controller: Arc::new(Controller::default()),
            mappings: Arc::new(Mutex::new(json!([]))),
            routing: Arc::new(Mutex::new(())),
            epoch: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            sequence: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            published_epoch: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            configuration: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            configured: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }
}

impl HqPlayer {
    /// Order explicit audio intent before dispatching any blocking work.
    pub(crate) fn reserve_transport(&self) -> u64 {
        let ticket = self.sequence.fetch_add(1, Ordering::SeqCst) + 1;
        self.epoch.fetch_max(ticket, Ordering::SeqCst);
        ticket
    }
    pub(crate) fn transport_current(&self, ticket: u64) -> bool {
        self.epoch.load(Ordering::SeqCst) == ticket
    }
    /// Order cleanup without cancelling other sources; exact login invalidation retires its own work.
    pub(crate) fn reserve_cleanup(&self) -> u64 {
        self.sequence.fetch_add(1, Ordering::SeqCst) + 1
    }
    /// Retire HQPlayer preparation through its endpoint profile, without cancelling local audio.
    pub(crate) fn begin_disconnect(&self) -> u64 {
        self.reserve()
    }
    /// Reserve endpoint configuration independently from catalogue/CD playback requests.
    pub(crate) fn reserve(&self) -> u64 {
        self.configuration.fetch_add(1, Ordering::SeqCst) + 1
    }
    pub(crate) fn connect(
        &self,
        ticket: u64,
        host: &str,
        port: u16,
        mappings: Value,
    ) -> Result<Value, String> {
        let _guard = self.routing.lock().map_err(|_| "HQPlayer occupé.")?;
        self.require_configuration(ticket)?;
        let result = (|| {
            let reply = self.controller.connect(host, port)?;
            *self.mappings.lock().map_err(|_| "HQPlayer occupé.")? = mappings;
            Ok(reply)
        })();
        self.require_configuration(ticket)?;
        self.configured.store(ticket, Ordering::SeqCst);
        result
    }
    pub(crate) fn disconnect(&self, ticket: u64) -> Result<(), String> {
        let _guard = self.routing.lock().map_err(|_| "HQPlayer occupé.")?;
        self.require_configuration(ticket)?;
        let result = self.controller.disconnect();
        self.require_configuration(ticket)?;
        self.configured.store(ticket, Ordering::SeqCst);
        result
    }
    fn require_configuration(&self, ticket: u64) -> Result<(), String> {
        if self.configuration.load(Ordering::SeqCst) != ticket {
            return Err("Configuration HQPlayer remplacée ou annulée.".into());
        }
        Ok(())
    }
    /// Capture the selected endpoint before the blocking playback worker can be delayed.
    pub(crate) fn capture_profile(&self) -> u64 {
        self.configuration.load(Ordering::SeqCst)
    }
    /// Admit only the endpoint selected when playback entered IPC.
    pub(crate) fn profile_at(&self, ticket: u64) -> Result<(u64, Value), String> {
        self.require_configuration(ticket)?;
        let profile = self.profile()?;
        self.require_configuration(ticket)?;
        Ok(profile)
    }
    /// Capture endpoint generation and folder mappings together, before source preparation IO.
    pub(crate) fn profile(&self) -> Result<(u64, Value), String> {
        let _guard = self.routing.lock().map_err(|_| "HQPlayer occupé.")?;
        let ticket = self.configuration.load(Ordering::SeqCst);
        if !self.profile_current(ticket) || !self.controller.connected() {
            return Err("Testez la connexion HQPlayer dans les paramètres.".into());
        }
        let mappings = self
            .mappings
            .lock()
            .map_err(|_| "HQPlayer occupé.")?
            .clone();
        Ok((ticket, mappings))
    }
    /// Used between preparation requests and again under routing before audio substitution.
    pub(crate) fn profile_current(&self, ticket: u64) -> bool {
        self.configuration.load(Ordering::SeqCst) == ticket
            && self.configured.load(Ordering::SeqCst) == ticket
    }
}

#[cfg(test)]
#[path = "hqplayer_test_support.rs"]
mod test_support;
#[cfg(test)]
#[path = "hqplayer_state_tests.rs"]
mod tests;
