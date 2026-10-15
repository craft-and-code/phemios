//! Single-occurrence edits retain slot identities while a different occurrence is audible.
use super::*;
pub(super) enum Outcome {
    Keep,
    Advance(usize),
    Stop,
}
/// Apply only to the retained queue. Removed slots cannot be restored by ordinary reordering.
pub(super) fn edit(state: &mut State, occurrence: usize, paused: bool) -> Result<Outcome, String> {
    let at = state
        .queue
        .iter()
        .position(|index| *index == occurrence)
        .ok_or("La liste de lecture a changé.")?;
    let current = state.index == occurrence;
    let next = state.queue.get(at + 1).copied();
    state.queue.remove(at);
    state.tracks[occurrence] = String::new();
    if state.queue.is_empty() {
        state.clear_selection();
        return Ok(Outcome::Stop);
    }
    if !current {
        return Ok(Outcome::Keep);
    }
    state.position = 0;
    state.duration = None;
    state.confirmed = false;
    if let Some(next) = next {
        state.index = next;
        state.reference = state.tracks[next].clone();
        state.status = if paused { "paused" } else { "connecting" };
        Ok(Outcome::Advance(next))
    } else {
        state.status = "idle";
        state.reference.clear();
        state.index = state.queue[0];
        Ok(Outcome::Stop)
    }
}
/// Reserve both voices before producing overlap PCM, atomically against occurrence edits.
pub(super) fn reserve_mix(
    state: &Mutex<State>,
    current: usize,
    next: usize,
) -> Result<bool, String> {
    let mut state = state.lock().map_err(|_| "État audio indisponible.")?;
    if !state.queue.contains(&next) {
        return Ok(false);
    }
    state.protected = vec![current, next];
    Ok(true)
}
impl Player {
    /// Remove one captured occurrence, never all copies of the same track reference.
    pub fn remove(&self, id: u64, occurrence: usize) -> Result<(), String> {
        let worker = self.worker.lock().map_err(|_| "Lecteur indisponible.")?;
        let worker = worker
            .as_ref()
            .filter(|worker| !worker.handle.is_finished())
            .ok_or("Aucune lecture active.")?;
        let mut state = self.state.lock().map_err(|_| "État audio indisponible.")?;
        if state.queue_id != id
            || occurrence >= state.tracks.len()
            || !state.queue.contains(&occurrence)
        {
            return Err("La liste de lecture a changé.".into());
        }
        if occurrence != state.index && state.protected.contains(&occurrence) {
            return Err(
                "Ce titre participe au fondu en cours. Réessayez à la fin du fondu.".into(),
            );
        }
        if occurrence != state.index {
            edit(&mut state, occurrence, false)?;
            return Ok(());
        }
        let (done, wait) = mpsc::sync_channel(1);
        worker
            .commands
            .try_send(Command::Remove(occurrence, done))
            .map_err(|_| "Lecteur occupé, réessayez.")?;
        self.signals.paused.store(true, Ordering::Relaxed);
        drop(state);
        wait.recv_timeout(std::time::Duration::from_secs(15))
            .map_err(|_| "Retrait de piste interrompu.")?
    }
}
#[cfg(test)]
#[path = "removal_tests.rs"]
mod tests;
