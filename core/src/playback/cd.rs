//! A CD is a temporary native source, never an Aède catalogue entry or a listening-history claim.
use super::*;
impl Player {
    /// Whether the retained selection comes from a physical CD, including Pause/Stop.
    pub fn is_cd(&self) -> Result<bool, String> {
        Ok(self
            .state
            .lock()
            .map_err(|_| "État audio indisponible.")?
            .local_cd)
    }
    /// Start only discovered audio tracks, reusing the output, queue, repeat, shuffle and spectrum.
    /// Optional account checks run away from the output callback; guests require no server.
    pub fn start_cd(
        &self,
        disc: phemios_cd::Disc,
        tracks: Vec<String>,
        device: String,
        index: usize,
        permission: Option<Box<dyn Fn() -> Result<(), String> + Send>>,
    ) -> Result<(), String> {
        if tracks.is_empty()
            || tracks.len() > 4096
            || index >= tracks.len()
            || device.len() > 2048
            || device == crate::hqplayer::OUTPUT
            || tracks
                .iter()
                .any(|reference| disc.track(reference).is_err())
        {
            return Err("Sélection CD ou sortie audio invalide.".into());
        }
        self.launch(
            actor::Source::Disc(disc, Arc::default()),
            tracks,
            device,
            index,
            Policy::WithoutEffects,
            permission,
        )
    }
}
