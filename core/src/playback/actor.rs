use super::output::Signals;
use super::stream::stream;
use super::{Command, State, update};
use crate::network::Client;
/// Native source substitution retains the existing transport and queue state machine.
pub(super) enum Source {
    Remote(Client),
    Disc(phemios_cd::Disc, Arc<Mutex<Option<String>>>),
}
impl Source {
    pub(super) fn failure(&self) -> Option<Arc<Mutex<Option<String>>>> {
        match self {
            Self::Disc(_, error) => Some(error.clone()),
            Self::Remote(_) => None,
        }
    }
}
use std::sync::{Arc, Mutex, mpsc::Receiver};
pub(super) fn run(
    source: Source,
    index: usize,
    output: (String, super::Policy),
    commands: Receiver<Command>,
    state: &Mutex<State>,
    signals: &Arc<Signals>,
) -> Result<(), String> {
    let (mut device, mut policy) = output;
    let mut queue = super::queue::Queue::new(
        state.lock().map_err(|_| "État audio indisponible.")?.total,
        index,
    );
    let mut position = 0;
    let mut paused = false;
    loop {
        synchronize(&mut queue, state)?;
        let index = queue.index();
        let action = if paused {
            commands.recv().map_err(|_| "Lecteur fermé.")?
        } else {
            update(state, |s| {
                s.status = "connecting";
                s.reference = s.tracks[index].clone();
                s.index = index;
                s.position = position;
                s.error.clear();
                s.confirmed = false;
                s.device = device.clone();
            })?;
            let crossfade_ms = state
                .lock()
                .map_err(|_| "État audio indisponible.")?
                .crossfade_ms;
            let reference =
                state.lock().map_err(|_| "État audio indisponible.")?.tracks[index].clone();
            let result = if let Source::Disc(disc, denied) = &source {
                super::cd_stream::stream(
                    disc, &reference, position, &device, &commands, state, signals, denied,
                )
            } else if let Source::Remote(client) = &source {
                if continuous_queue(
                    policy,
                    state.lock().map_err(|_| "État audio indisponible.")?.total,
                ) {
                    super::crossfade::stream(
                        client,
                        (index, position),
                        (&device, policy),
                        crossfade_ms,
                        &commands,
                        state,
                        signals,
                    )
                } else {
                    stream(
                        client,
                        &reference,
                        position,
                        (&device, policy),
                        &commands,
                        state,
                        signals,
                    )
                }
            } else {
                return Err("Source audio invalide.".into());
            }?;
            // A hot mode selection is retained while the current visit drains.
            policy = state.lock().map_err(|_| "État audio indisponible.")?.policy;
            queue.jump(state.lock().map_err(|_| "État audio indisponible.")?.index);
            match result {
                Some(command) => command,
                None => {
                    synchronize(&mut queue, state)?;
                    if queue.advance(
                        state.lock().map_err(|_| "État audio indisponible.")?.repeat,
                        true,
                    ) {
                        position = 0;
                        continue;
                    }
                    update(state, |s| s.status = "ended")?;
                    paused = true;
                    continue;
                }
            }
        };
        position = state
            .lock()
            .map_err(|_| "État audio indisponible.")?
            .position;
        if matches!(source, Source::Disc(..)) {
            paused = state.lock().map_err(|_| "État audio indisponible.")?.status == "paused";
        }
        synchronize(&mut queue, state)?;
        match action {
            Command::Jump(value) => {
                if !queue.jump(value) {
                    return Err("Position de file invalide.".into());
                }
                position = 0;
                paused = false;
            }
            Command::Remove(occurrence, done) => {
                let outcome = {
                    let mut state = state.lock().map_err(|_| "État audio indisponible.")?;
                    super::removal::edit(&mut state, occurrence, paused)
                };
                match outcome {
                    Ok(super::removal::Outcome::Stop) => {
                        let _ = done.send(Ok(()));
                        return Ok(());
                    }
                    Ok(super::removal::Outcome::Advance(next)) => {
                        position = 0;
                        queue.jump(next);
                        synchronize(&mut queue, state)?;
                        let _ = done.send(Ok(()));
                    }
                    Ok(super::removal::Outcome::Keep) => {
                        synchronize(&mut queue, state)?;
                        let _ = done.send(Ok(()));
                    }
                    Err(error) => {
                        let _ = done.send(Err(error));
                    }
                }
            }
            Command::Crossfade(value) => {
                update(state, |s| s.crossfade_ms = value)?;
            }
            Command::Policy(value) => {
                policy = value;
                update(state, |s| s.policy = value)?;
            }
            Command::Stop => {
                update(state, |s| s.status = "idle")?;
                return Ok(());
            }
            Command::Pause => {
                paused = true;
                update(state, |s| s.status = "paused")?;
            }
            Command::Resume => {
                if state.lock().map_err(|_| "État audio indisponible.")?.status == "ended" {
                    queue.first();
                    position = 0;
                }
                paused = false;
            }
            Command::Next => {
                if queue.advance(
                    state.lock().map_err(|_| "État audio indisponible.")?.repeat,
                    false,
                ) {
                    position = 0;
                    paused = false;
                } else {
                    paused = true;
                    update(state, |s| s.status = "ended")?;
                }
            }
            Command::Previous => {
                if position <= 3000 {
                    queue.previous();
                }
                position = 0;
                paused = false;
            }
            Command::Seek(value, ticket) => {
                position = value;
                update(state, |s| {
                    s.position = position;
                    s.seek_id = ticket;
                })?;
            }
            Command::Output(value) => {
                device = value;
                update(state, |s| s.device = device.clone())?;
            }
        }
    }
}

fn synchronize(queue: &mut super::queue::Queue, state: &Mutex<State>) -> Result<(), String> {
    let state = state.lock().map_err(|_| "État audio indisponible.")?;
    queue.synchronize(&state.queue, state.shuffled, state.total)
}

/// Album queues keep one output open even without effects or overlap.
fn continuous_queue(policy: super::Policy, total: usize) -> bool {
    total > 1 || matches!(policy, super::Policy::Dsp)
}
#[cfg(test)]
#[path = "actor_tests.rs"]
mod tests;
