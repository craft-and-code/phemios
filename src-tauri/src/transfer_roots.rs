//! Source-qualified protected roots outlive preview and are rechecked before publication.
use phemios_core::local::Engine;
use phemios_transfer::{DestinationGuard, Mounted};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};

pub(super) struct Protection {
    engine: Arc<Mutex<Engine>>,
    configured: Vec<PathBuf>,
    guard: DestinationGuard,
}
impl Protection {
    pub(super) fn capture(
        mount: &Mounted,
        engine: Arc<Mutex<Engine>>,
        local: &[String],
        remote: &[String],
    ) -> Result<Self, String> {
        let configured = engine
            .lock()
            .map_err(|_| "Moteur occupé.")?
            .library_roots()?;
        let mut protected = configured.clone();
        protected.extend(local.iter().map(PathBuf::from));
        let protected = protected
            .into_iter()
            .collect::<std::collections::BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        let guard = DestinationGuard::capture(mount, &protected, remote)?;
        Ok(Self {
            engine,
            configured,
            guard,
        })
    }
    pub(super) fn confirm(&self) -> Result<(), String> {
        let roots = self
            .engine
            .lock()
            .map_err(|_| "Moteur occupé.")?
            .library_roots()?;
        if roots != self.configured {
            return Err("Les dossiers locaux ont changé. Recréez l’aperçu du transfert.".into());
        }
        self.guard.confirm()
    }
}

#[cfg(test)]
#[path = "transfer_roots_tests.rs"]
mod tests;
