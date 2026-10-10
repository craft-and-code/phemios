use super::output::Signals;
use super::stream::stream;
use super::{Command, State, update};
use crate::network::Client;
use std::sync::{Arc, Mutex, mpsc::Receiver};
pub(super) fn run(
    client: Client,
    tracks: Vec<String>,
    index: usize,
    output: (String, super::Policy),
    commands: Receiver<Command>,
    state: &Mutex<State>,
    signals: &Arc<Signals>,
) -> Result<(), String> {
    let (mut device, mut policy) = output;
    let mut queue = super::queue::Queue::new(tracks.len(), index);
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
                s.reference = tracks[index].clone();
                s.index = index;
                s.position = position;
                s.error.clear();
                s.confirmed = false;
                s.device = device.clone();
            })?;
            match stream(
                &client,
                &tracks[index],
                position,
                (&device, policy),
                &commands,
                state,
                signals,
            )? {
                Some(command) => command,
                None => {
                    synchronize(&mut queue, state)?;
                    if queue.next() {
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
        synchronize(&mut queue, state)?;
        match action {
            Command::Jump(value) => {
                if !queue.jump(value) {
                    return Err("Position de file invalide.".into());
                }
                position = 0;
                paused = false;
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
                if queue.next() {
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
    queue.synchronize(&state.queue, state.shuffled)
}
