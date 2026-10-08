use super::output::Signals;
use super::stream::stream;
use super::{Command, State, update};
use crate::network::Client;
use std::sync::{Arc, Mutex, mpsc::Receiver};
pub(super) fn run(
    client: Client,
    tracks: Vec<String>,
    mut index: usize,
    output: (String, super::Policy),
    commands: Receiver<Command>,
    state: &Mutex<State>,
    signals: &Arc<Signals>,
) -> Result<(), String> {
    let (mut device, mut policy) = output;
    let mut position = 0;
    let mut paused = false;
    loop {
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
                    if index + 1 < tracks.len() {
                        index += 1;
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
        match action {
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
                    index = 0;
                    position = 0;
                }
                paused = false;
            }
            Command::Next => {
                if index + 1 < tracks.len() {
                    index += 1;
                    position = 0;
                    paused = false;
                } else {
                    paused = true;
                    update(state, |s| s.status = "ended")?;
                }
            }
            Command::Previous => {
                if position <= 3000 && index > 0 {
                    index -= 1;
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
