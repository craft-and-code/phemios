//! Native consumed-frame PCM client for Aède's authenticated playback contract.
mod actor;
mod crossfade;
mod crossfade_mix;
mod crossfade_source;
mod output;
mod protocol;
mod queue;
mod socket;
mod spectrum;
mod stream;
use crate::network::Client;
use output::Signals;
use serde_json::{Value, json};
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicU64, Ordering},
    mpsc::{self, SyncSender},
};
use std::thread::JoinHandle;
#[derive(Clone)]
enum Command {
    Policy(Policy),
    Crossfade(u64),
    Jump(usize),
    Pause,
    Resume,
    Next,
    Previous,
    Seek(u64, u64),
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
    seek_id: u64,
    queue_id: u64,
    rate: u32,
    error: String,
    confirmed: bool,
    device: String,
    policy: Policy,
    shuffled: bool,
    repeat: &'static str,
    crossfade_ms: u64,
    queue: Vec<usize>,
}
/// One bounded actor owns the socket and device; no credential enters the UI or audio callback.
pub struct Player {
    worker: Mutex<Option<Worker>>,
    next_seek: AtomicU64,
    next_queue: AtomicU64,
    state: Arc<Mutex<State>>,
    signals: Arc<Signals>,
}
impl Default for Player {
    fn default() -> Self {
        Self {
            worker: Mutex::new(None),
            next_seek: AtomicU64::new(1),
            next_queue: AtomicU64::new(1),
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
        let levels = if s.status == "playing" && !self.signals.paused.load(Ordering::Relaxed) {
            self.signals
                .levels
                .each_ref()
                .map(|v| f32::from_bits(v.load(Ordering::Relaxed)))
        } else {
            [0.; 4]
        };
        let level = if s.status == "playing" && !self.signals.paused.load(Ordering::Relaxed) {
            f32::from_bits(self.signals.level.load(Ordering::Relaxed))
        } else {
            0.
        };
        let spectrum = if s.status == "playing" && !self.signals.paused.load(Ordering::Relaxed) {
            self.signals
                .spectrum
                .each_ref()
                .map(|v| f32::from_bits(v.load(Ordering::Relaxed)))
        } else {
            [0.; 24]
        };
        Ok(
            json!({"spectrum":spectrum,"spectrum_hz":spectrum::frequencies(),"crossfade_ms":s.crossfade_ms,"repeat":if s.repeat.is_empty() { "off" } else { s.repeat },"queue_id":s.queue_id,"shuffled":s.shuffled,"queue":s.queue,"seek_id":s.seek_id,"level":level,"levels":levels,"status":s.status,"reference":s.reference,"index":s.index,"total":s.total,"position_ms":s.position,"duration_ms":s.duration,"sample_rate":s.rate,"error":s.error,"history_confirmed":s.confirmed,"device":s.device,"policy":s.policy.name(),"volume":f32::from_bits(self.signals.volume.load(Ordering::Relaxed))}),
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
        let crossfade_ms = self
            .state
            .lock()
            .map_err(|_| "État audio indisponible.")?
            .crossfade_ms;
        let repeat = self
            .state
            .lock()
            .map_err(|_| "État audio indisponible.")?
            .repeat;
        *self.state.lock().map_err(|_| "État audio indisponible.")? = State {
            repeat,
            crossfade_ms,
            status: "connecting",
            total: tracks.len(),
            index,
            queue: (0..tracks.len()).collect(),
            queue_id: self.next_queue.fetch_add(1, Ordering::Relaxed),
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
    /// Queue a seek and return its ticket; snapshots acknowledge it only after the actor applies it.
    pub fn seek(&self, position: u64) -> Result<u64, String> {
        if position > 86_400_000 {
            return Err("Position invalide.".into());
        }
        let worker = self.worker.lock().map_err(|_| "Lecteur indisponible.")?;
        let worker = worker
            .as_ref()
            .filter(|w| !w.handle.is_finished())
            .ok_or("Aucune lecture active.")?;
        let ticket = self.next_seek.fetch_add(1, Ordering::Relaxed);
        worker
            .commands
            .try_send(Command::Seek(position, ticket))
            .map_err(|_| "Lecteur occupé, réessayez.")?;
        self.signals.paused.store(true, Ordering::Relaxed);
        Ok(ticket)
    }
    /// Narrow transport controls; unsupported values are explicit errors.
    pub fn control(&self, action: &str, value: Value) -> Result<(), String> {
        if action == "crossfade" {
            let ms = value
                .as_u64()
                .filter(|ms| *ms <= 10000)
                .ok_or("Durée du fondu invalide.")?;
            let worker = self.worker.lock().map_err(|_| "Lecteur indisponible.")?;
            if let Some(worker) = worker
                .as_ref()
                .filter(|worker| !worker.handle.is_finished())
            {
                worker
                    .commands
                    .try_send(Command::Crossfade(ms))
                    .map_err(|_| "Lecteur occupé, réessayez.".to_owned())?;
                self.signals.paused.store(true, Ordering::Relaxed);
                return Ok(());
            }
            return update(&self.state, |state| state.crossfade_ms = ms);
        }
        if action == "repeat" {
            let repeat = match value.as_str() {
                Some("off") => "off",
                Some("one") => "one",
                Some("all") => "all",
                _ => return Err("Répétition invalide.".into()),
            };
            return update(&self.state, |s| s.repeat = repeat);
        }
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
        if action == "seek" {
            return self
                .seek(value.as_u64().ok_or("Position invalide.")?)
                .map(|_| ());
        }
        if action == "queue" {
            let id = value["queue_id"]
                .as_u64()
                .ok_or("File de lecture invalide.")?;
            let order = value["order"]
                .as_array()
                .filter(|order| !order.is_empty() && order.len() <= 4096)
                .ok_or("File de lecture invalide.")?
                .iter()
                .map(|index| {
                    index
                        .as_u64()
                        .filter(|index| *index < 4096)
                        .map(|index| index as usize)
                        .ok_or("File de lecture invalide.")
                })
                .collect::<Result<Vec<_>, _>>()?;
            let worker = self.worker.lock().map_err(|_| "Lecteur indisponible.")?;
            if worker
                .as_ref()
                .is_none_or(|worker| worker.handle.is_finished())
            {
                return Err("Aucune lecture active.".into());
            }
            let mut state = self.state.lock().map_err(|_| "État audio indisponible.")?;
            if state.queue_id != id || state.total == 0 || state.index >= state.total {
                return Err("La liste de lecture a changé.".into());
            }
            let mut queue = queue::Queue::new(state.total, state.index);
            queue.synchronize(&order, false)?;
            state.queue = queue.order().to_vec();
            state.shuffled = false;
            return Ok(());
        }
        if action == "shuffle" {
            let enabled = value.as_bool().ok_or("Lecture aléatoire invalide.")?;
            let worker = self.worker.lock().map_err(|_| "Lecteur indisponible.")?;
            if worker
                .as_ref()
                .is_none_or(|worker| worker.handle.is_finished())
            {
                return Err("Aucune lecture active.".into());
            }
            let mut state = self.state.lock().map_err(|_| "État audio indisponible.")?;
            if state.queue.is_empty() {
                return Err("Aucune lecture active.".into());
            }
            let mut queue = queue::Queue::new(state.total, state.index);
            queue.synchronize(&state.queue, state.shuffled)?;
            queue.shuffle(enabled)?;
            state.queue = queue.order().to_vec();
            state.shuffled = queue.shuffled();
            return Ok(());
        }
        let command = match action {
            "policy" => Command::Policy(Policy::parse(value.as_str().ok_or("Mode invalide.")?)?),
            "pause" => Command::Pause,
            "resume" => Command::Resume,
            "jump" => Command::Jump(
                value
                    .as_u64()
                    .filter(|index| {
                        self.state
                            .lock()
                            .is_ok_and(|state| *index < state.total as u64)
                    })
                    .ok_or("Position de file invalide.")? as usize,
            ),
            "next" => Command::Next,
            "previous" => Command::Previous,
            "stop" => Command::Stop,
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
