//! Consumed-frame feedback and reset admission for one retained crossfade visit.
use super::crossfade_source::{Clock, Envelope, Packet};
use super::socket;
use serde_json::{Value, json};
use std::sync::{
    atomic::Ordering,
    mpsc::{SyncSender, TrySendError},
};
use std::time::{Duration, Instant};
fn send(socket: &mut socket::Socket, value: Value) -> Result<(), String> {
    socket
        .send(tungstenite::Message::Text(value.to_string().into()))
        .map_err(|_| "Flux de fondu interrompu.".into())
}
pub(super) struct Feedback {
    pub epoch: u64,
    pub generation: u64,
    pub seeking: bool,
    pub acknowledged: u64,
    pub last: Instant,
    pub eof: Option<u64>,
    pub stopped: bool,
    pub deadline: Option<Instant>,
}
impl Feedback {
    pub fn tick(&mut self, socket: &mut socket::Socket, clock: &Clock) -> Result<(), String> {
        if !self.seeking && !self.stopped {
            let request = clock
                .seek
                .lock()
                .map_err(|_| "Commande de fondu indisponible.")?
                .take();
            if let Some(request) = request {
                send(
                    socket,
                    json!({"type":"seek","epoch":self.epoch,"frames":request.frames,"position_ms":request.position}),
                )?;
                self.generation = request.generation;
                self.seeking = true;
                self.eof = None;
                self.deadline = Some(Instant::now() + Duration::from_secs(12));
            }
        }
        // Stop publishes the mixer's final contribution. Acquire it before the
        // count so a worker cannot stop with an earlier callback's local value.
        let stopping = clock.stop.load(Ordering::Acquire);
        let frames = clock.consumed.load(Ordering::Relaxed);
        if !self.seeking && stopping && !self.stopped {
            send(
                socket,
                json!({"type":"stop","epoch":self.epoch,"frames":frames}),
            )?;
            self.stopped = true;
            self.deadline = Some(Instant::now() + Duration::from_secs(12));
        } else if !self.seeking
            && !self.stopped
            && frames > self.acknowledged
            && (self.last.elapsed() >= Duration::from_millis(40) || self.eof == Some(frames))
        {
            send(
                socket,
                json!({"type":"ack","epoch":self.epoch,"frames":frames}),
            )?;
            self.acknowledged = frames;
            self.last = Instant::now();
        }
        if self.deadline.is_some_and(|time| Instant::now() > time) {
            return Err("Confirmation de l’écoute absente.".into());
        }
        Ok(())
    }
    pub fn publish(
        &mut self,
        socket: &mut socket::Socket,
        clock: &Clock,
        tx: &SyncSender<Envelope>,
        packet: Result<Packet, String>,
    ) -> Result<bool, String> {
        let mut envelope = Envelope {
            generation: self.generation,
            packet,
        };
        loop {
            self.tick(socket, clock)?;
            if self.stopped || self.seeking {
                return Ok(false);
            }
            match tx.try_send(envelope) {
                Ok(()) => return Ok(true),
                Err(TrySendError::Disconnected(_)) => {
                    clock.stop.store(true, Ordering::Release);
                    return Ok(false);
                }
                Err(TrySendError::Full(value)) => envelope = value,
            }
            std::thread::sleep(Duration::from_millis(2));
        }
    }
}
