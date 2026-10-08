//! Native consumed-frame PCM client for Aède's authenticated playback contract.
mod actor;
mod output;
mod protocol;
mod socket;
mod stream;
use crate::network::Client;
use output::Signals;
use serde_json::{Value, json};
use std::sync::{
    Arc, Mutex,
    atomic::Ordering,
    mpsc::{self, SyncSender},
};
use std::thread::JoinHandle;
#[derive(Clone)]
enum Command {
    Policy(Policy),
    Pause,
    Resume,
    Next,
    Previous,
    Seek(u64),
    Stop,
    Output(String),
}
#[derive(Clone, Copy, Default)]
pub(super) enum Policy {
    #[default]
    WithoutEffects,
    Dsp,
}
impl Policy {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "without-effects" => Ok(Self::WithoutEffects),
            "dsp" => Ok(Self::Dsp),
            _ => Err("Le flux PCM ne prend pas en charge ce mode de lecture.".into()),
        }
    }
    fn name(self) -> &'static str {
        match self {
            Self::WithoutEffects => "without-effects",
            Self::Dsp => "dsp",
        }
    }
}
struct Worker {
    commands: SyncSender<Command>,
    handle: JoinHandle<()>,
}
#[derive(Default)]
struct State {
    status: &'static str,
    reference: String,
    index: usize,
    total: usize,
    position: u64,
    duration: Option<u64>,
    rate: u32,
    error: String,
    confirmed: bool,
    device: String,
    policy: Policy,
}
/// One bounded actor owns the socket and device; no credential enters the UI or audio callback.
pub struct Player {
    worker: Mutex<Option<Worker>>,
    state: Arc<Mutex<State>>,
    signals: Arc<Signals>,
}
impl Default for Player {
    fn default() -> Self {
        Self {
            worker: Mutex::new(None),
            state: Arc::new(Mutex::new(State {
                status: "idle",
                ..State::default()
            })),
            signals: Arc::new(Signals::default()),
        }
    }
}
impl Player {
    /// Discover current native outputs only on an explicit client request.
    pub fn devices(&self) -> Result<Value, String> {
        output::devices()
    }
    /// Return public player state, never source paths, session credentials or buffered PCM.
    pub fn snapshot(&self) -> Result<Value, String> {
        let s = self.state.lock().map_err(|_| "État audio indisponible.")?;
        Ok(
            json!({"status":s.status,"reference":s.reference,"index":s.index,"total":s.total,"position_ms":s.position,"duration_ms":s.duration,"sample_rate":s.rate,"error":s.error,"history_confirmed":s.confirmed,"device":s.device,"policy":s.policy.name(),"volume":f32::from_bits(self.signals.volume.load(Ordering::Relaxed))}),
        )
    }
    /// Replace an explicit ordered selection after stopping its previous stream and device.
    pub fn start(
        &self,
        client: Client,
        tracks: Vec<String>,
        device: String,
        index: usize,
        policy: &str,
    ) -> Result<(), String> {
        let policy = Policy::parse(policy)?;
        if tracks.is_empty()
            || tracks.len() > 4096
            || index >= tracks.len()
            || device.len() > 2048
            || tracks
                .iter()
                .any(|r| protocol::start(r, 48000, policy).is_err())
        {
            return Err(
                "Sélection audio invalide ou trop volumineuse (4096 pistes maximum).".into(),
            );
        }
        if !matches!(
            client.account()["account"]["role"].as_str(),
            Some("user" | "admin")
        ) {
            return Err("Votre compte ne permet pas la lecture.".into());
        }
        let mut slot = self.worker.lock().map_err(|_| "Lecteur indisponible.")?;
        self.signals.paused.store(true, Ordering::Relaxed);
        if let Some(old) = slot.take() {
            let _ = old.commands.send(Command::Stop);
            old.handle
                .join()
                .map_err(|_| "Arrêt du lecteur interrompu.")?;
        }
        let (tx, rx) = mpsc::sync_channel(32);
        let state = self.state.clone();
        let signals = self.signals.clone();
        *self.state.lock().map_err(|_| "État audio indisponible.")? = State {
            status: "connecting",
            total: tracks.len(),
            device: device.clone(),
            policy,
            ..State::default()
        };
        let handle = std::thread::spawn(move || {
            if let Err(error) = actor::run(
                client,
                tracks,
                index,
                (device, policy),
                rx,
                &state,
                &signals,
            ) {
                signals.paused.store(true, Ordering::Relaxed);
                if let Ok(mut s) = state.lock() {
                    s.status = "error";
                    s.error = error;
                }
            }
        });
        *slot = Some(Worker {
            commands: tx,
            handle,
        });
        Ok(())
    }
    /// Stop and join the native worker before revoking its authentication session.
    pub fn halt(&self) -> Result<(), String> {
        let mut slot = self.worker.lock().map_err(|_| "Lecteur indisponible.")?;
        self.signals.paused.store(true, Ordering::Relaxed);
        if let Some(worker) = slot.as_ref()
            && !worker.handle.is_finished()
        {
            worker
                .commands
                .try_send(Command::Stop)
                .map_err(|_| "Lecteur occupé, réessayez.")?;
        }
        if let Some(worker) = slot.take() {
            worker
                .handle
                .join()
                .map_err(|_| "Arrêt audio interrompu.")?;
        }
        update(&self.state, |s| s.status = "idle")
    }
    /// Narrow transport controls; unsupported values are explicit errors.
    pub fn control(&self, action: &str, value: Value) -> Result<(), String> {
        if action == "volume" {
            let volume = value
                .as_f64()
                .filter(|v| v.is_finite() && (0.0..=1.0).contains(v))
                .ok_or("Volume invalide.")?;
            self.signals
                .volume
                .store((volume as f32).to_bits(), Ordering::Relaxed);
            return Ok(());
        }
        let command = match action {
            "policy" => Command::Policy(Policy::parse(value.as_str().ok_or("Mode invalide.")?)?),
            "pause" => Command::Pause,
            "resume" => Command::Resume,
            "next" => Command::Next,
            "previous" => Command::Previous,
            "stop" => Command::Stop,
            "seek" => Command::Seek(
                value
                    .as_u64()
                    .filter(|v| *v <= 86_400_000)
                    .ok_or("Position invalide.")?,
            ),
            "output" => Command::Output(
                value
                    .as_str()
                    .filter(|v| v.len() <= 2048)
                    .ok_or("Sortie invalide.")?
                    .into(),
            ),
            _ => return Err("Commande audio non prise en charge.".into()),
        };
        let worker = self.worker.lock().map_err(|_| "Lecteur indisponible.")?;
        if matches!(command, Command::Stop) && worker.is_none() {
            return Ok(());
        }
        let worker = worker
            .as_ref()
            .filter(|w| !w.handle.is_finished())
            .ok_or("Aucune lecture active.")?;
        worker
            .commands
            .try_send(command)
            .map_err(|_| "Lecteur occupé, réessayez.")?;
        if action != "resume" {
            self.signals.paused.store(true, Ordering::Relaxed);
        }
        Ok(())
    }
}
impl Drop for Player {
    fn drop(&mut self) {
        self.signals.paused.store(true, Ordering::Relaxed);
        if let Ok(slot) = self.worker.get_mut()
            && let Some(worker) = slot.take()
        {
            let _ = worker.commands.try_send(Command::Stop);
        }
    }
}
fn update(state: &Mutex<State>, work: impl FnOnce(&mut State)) -> Result<(), String> {
    let mut s = state.lock().map_err(|_| "État audio indisponible.")?;
    work(&mut s);
    Ok(())
}

#[cfg(test)]
#[path = "player_tests.rs"]
mod tests;
