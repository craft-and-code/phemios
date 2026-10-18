//! Local CD transport shares callback consumption, waveform levels and the existing queue actor.
use super::{
    Command, State,
    cd_reader::{Event, Reader},
    output::{Output, Signals},
    update,
};
use std::{
    sync::{
        Arc, Mutex,
        atomic::Ordering,
        mpsc::{self, Receiver},
    },
    time::{Duration, Instant},
};
pub(super) fn stream(
    disc: &phemios_cd::Disc,
    reference: &str,
    initial: u64,
    device: &str,
    commands: &Receiver<Command>,
    state: &Mutex<State>,
    signals: &Arc<Signals>,
    denied: &Mutex<Option<String>>,
) -> Result<Option<Command>, String> {
    let track = disc.track(reference)?;
    let total = track.frames;
    let mut offset = (initial.saturating_mul(44100) / 1000).min(total);
    signals.paused.store(true, Ordering::Relaxed);
    let mut output = Output::open_cd(device, signals.clone())?;
    let reader = Reader::new(disc.clone(), track.number, offset);
    let mut epoch = 0;
    let mut ended = false;
    let mut paused = false;
    let mut pending: Option<(u64, std::vec::IntoIter<[f32; 2]>)> = None;
    let mut sent = 0u64;
    let mut seek_id = None;
    let mut progress = Instant::now();
    let mut last_consumed = 0;
    update(state, |s| {
        s.duration = Some(track.duration_ms());
        s.rate = 44100;
    })?;
    loop {
        if let Some(error) = denied
            .lock()
            .map_err(|_| "Contrôle du compte indisponible.")?
            .clone()
        {
            return Err(error);
        }
        let consumed = output.consumed.load(Ordering::Relaxed);
        update(state, |s| {
            s.position = (offset + consumed).min(total) * 1000 / 44100
        })?;
        match commands.try_recv() {
            Ok(Command::Crossfade(ms)) => update(state, |s| s.crossfade_ms = ms)?,
            Ok(Command::Policy(super::Policy::WithoutEffects)) => {}
            Ok(Command::Policy(super::Policy::Dsp)) => {
                return Err("Le traitement DSP n’est pas disponible pour les CD.".into());
            }
            Ok(Command::Pause) => {
                paused = true;
                signals.paused.store(true, Ordering::Relaxed);
                update(state, |s| s.status = "paused")?;
            }
            Ok(Command::Resume) => {
                paused = false;
                signals.paused.store(false, Ordering::Relaxed);
                progress = Instant::now();
                update(state, |s| s.status = "playing")?;
            }
            Ok(Command::Seek(ms, ticket)) => {
                signals.paused.store(true, Ordering::Relaxed);
                signals.finished.store(false, Ordering::Release);
                output.reset()?;
                offset = (ms.saturating_mul(44100) / 1000).min(total);
                epoch = reader.seek(offset)?;
                pending = None;
                ended = false;
                sent = 0;
                last_consumed = 0;
                seek_id = Some(ticket);
                progress = Instant::now();
                update(state, |s| {
                    s.position = offset * 1000 / 44100;
                    s.status = if paused { "paused" } else { "connecting" };
                })?;
            }
            Ok(command) => {
                signals.paused.store(true, Ordering::Relaxed);
                output.freeze()?;
                let consumed = output.consumed.load(Ordering::Relaxed);
                update(state, |s| {
                    s.position = (offset + consumed).min(total) * 1000 / 44100
                })?;
                return Ok(Some(command));
            }
            Err(mpsc::TryRecvError::Disconnected) => return Ok(Some(Command::Stop)),
            Err(mpsc::TryRecvError::Empty) => {}
        }
        if output.failed.load(Ordering::Relaxed) {
            return Err("La sortie audio a signalé une erreur ou une déconnexion.".into());
        }
        if pending.is_none() {
            match reader.received.try_recv() {
                Ok(Event::Pcm(e, chunk)) if e == epoch => {
                    pending = Some((e, chunk.frames().collect::<Vec<_>>().into_iter()));
                    progress = Instant::now();
                    if !paused {
                        signals.paused.store(false, Ordering::Relaxed);
                    }
                    update(state, |s| {
                        s.status = if paused { "paused" } else { "playing" };
                        if let Some(ticket) = seek_id.take() {
                            s.seek_id = ticket;
                        }
                    })?;
                }
                Ok(Event::End(e)) if e == epoch => {
                    ended = true;
                    signals.finished.store(true, Ordering::Release);
                    progress = Instant::now();
                    update(state, |s| {
                        if let Some(ticket) = seek_id.take() {
                            s.seek_id = ticket;
                        }
                    })?;
                }
                Ok(Event::Error(error)) => return Err(error),
                Err(mpsc::TryRecvError::Disconnected) => {
                    return Err("Le flux du lecteur CD a été interrompu.".into());
                }
                _ => {}
            }
        }
        if let Some((_, frames)) = &mut pending {
            let slots = output.producer.slots().min(frames.len());
            for frame in frames.by_ref().take(slots) {
                output
                    .producer
                    .push(frame)
                    .map_err(|_| "Tampon audio CD indisponible.")?;
                sent += 1;
            }
            if frames.len() == 0 {
                pending = None;
            }
        }
        if ended && output.consumed.load(Ordering::Relaxed) == sent && !paused {
            update(state, |s| s.position = track.duration_ms())?;
            return Ok(None);
        }
        let current_consumed = output.consumed.load(Ordering::Relaxed);
        if current_consumed > last_consumed {
            progress = Instant::now();
            last_consumed = current_consumed;
        }
        if !paused && progress.elapsed() > Duration::from_secs(15) {
            return Err("Le lecteur CD ne répond plus.".into());
        }
        std::thread::sleep(Duration::from_millis(2));
    }
}
