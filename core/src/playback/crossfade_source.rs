//! Two independently authenticated visits; ACKs count each voice actually rendered.
use super::crossfade_feedback::Feedback;
use super::{Policy, protocol, socket};
use crate::network::Client;
use serde_json::{Value, json};
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, AtomicU64, Ordering},
    mpsc::{self, Receiver, SyncSender},
};
use std::time::{Duration, Instant};
use tungstenite::Message;

pub(super) enum Packet {
    Format(protocol::Format),
    Samples(Vec<[f32; 2]>),
    End,
}
pub(super) struct Envelope {
    pub generation: u64,
    pub packet: Result<Packet, String>,
}
pub(super) struct SeekRequest {
    pub position: u64,
    pub frames: u64,
    pub generation: u64,
}
pub(super) struct Clock {
    pub consumed: AtomicU64,
    pub generation: AtomicU64,
    pub seek: Mutex<Option<SeekRequest>>,
    pub stop: AtomicBool,
    pub confirmed: AtomicBool,
}
pub(super) struct Source {
    packets: Receiver<Envelope>,
    generation: u64,
    pub clock: Arc<Clock>,
    handle: Option<std::thread::JoinHandle<Result<(), String>>>,
    failure: Option<String>,
}
impl Source {
    pub fn open(client: &Client, reference: String, rate: u32, initial: u64) -> Self {
        let client = client.clone();
        let (tx, packets) = mpsc::sync_channel(4);
        let clock = Arc::new(Clock {
            consumed: AtomicU64::new(0),
            generation: AtomicU64::new(0),
            seek: Mutex::new(None),
            stop: AtomicBool::new(false),
            confirmed: AtomicBool::new(false),
        });
        let held = clock.clone();
        let handle = std::thread::spawn(move || {
            let result = pump(&client, &reference, rate, initial, &tx, &held);
            if let Err(error) = &result {
                let _ = tx.try_send(Envelope {
                    generation: held.generation.load(Ordering::Acquire),
                    packet: Err(error.clone()),
                });
            }
            result
        });
        Self {
            packets,
            generation: 0,
            clock,
            handle: Some(handle),
            failure: None,
        }
    }
    /// Retain this visit and discard old prefetched packets without closing its socket.
    pub fn seek(&mut self, position: u64, frames: u64) -> Result<(), String> {
        if position > 86_400_000 || self.clock.stop.load(Ordering::Relaxed) {
            return Err("Déplacement du fondu invalide.".into());
        }
        let mut request = self
            .clock
            .seek
            .lock()
            .map_err(|_| "Commande de fondu indisponible.")?;
        if request.is_some() {
            return Err("Déplacement du fondu déjà en cours.".into());
        }
        self.generation = self
            .generation
            .checked_add(1)
            .ok_or("Génération du fondu épuisée.")?;
        self.clock.consumed.store(0, Ordering::Relaxed);
        self.clock
            .generation
            .store(self.generation, Ordering::Release);
        *request = Some(SeekRequest {
            position,
            frames,
            generation: self.generation,
        });
        Ok(())
    }
    pub fn try_recv(&self) -> Result<Result<Packet, String>, mpsc::TryRecvError> {
        loop {
            let value = self.packets.try_recv()?;
            if value.generation == self.generation {
                return Ok(value.packet);
            }
        }
    }
    /// Ask the existing worker to confirm its visit without waiting on the producer.
    /// A mixer keeps at most one retiring source; a pending result retains its handle.
    pub fn retire(&mut self) -> Result<bool, String> {
        self.clock.stop.store(true, Ordering::Release);
        if self
            .handle
            .as_ref()
            .is_some_and(|handle| !handle.is_finished())
        {
            return Ok(false);
        }
        self.finish()?;
        Ok(true)
    }
    pub fn finish(&mut self) -> Result<(), String> {
        self.clock.stop.store(true, Ordering::Release);
        if let Some(failure) = &self.failure {
            return Err(failure.clone());
        }
        if let Some(handle) = self.handle.take() {
            let result = handle
                .join()
                .map_err(|_| "Arrêt du flux de fondu interrompu.".to_owned())
                .and_then(|result| result);
            if let Err(error) = &result {
                self.failure = Some(error.clone());
            }
            result?;
        }
        Ok(())
    }
}
impl Drop for Source {
    fn drop(&mut self) {
        let _ = self.finish();
    }
}
fn send(socket: &mut socket::Socket, value: Value) -> Result<(), String> {
    socket
        .send(Message::Text(value.to_string()))
        .map_err(|_| "Flux de fondu interrompu.".into())
}
fn pump(
    client: &Client,
    reference: &str,
    rate: u32,
    initial: u64,
    tx: &SyncSender<Envelope>,
    clock: &Clock,
) -> Result<(), String> {
    let mut socket = socket::connect(client)?;
    send(
        &mut socket,
        serde_json::from_str(&protocol::start(reference, rate, Policy::Dsp)?)
            .map_err(|_| "Démarrage de fondu invalide.")?,
    )?;
    let mut feedback = Feedback {
        epoch: 0,
        generation: 0,
        seeking: false,
        acknowledged: 0,
        last: Instant::now(),
        eof: None,
        stopped: false,
        deadline: None,
    };
    let mut channels = None;
    let mut seeking = initial > 0;
    let mut seek_sent = false;
    let mut sent = 0_u64;
    loop {
        feedback.tick(&mut socket, clock)?;
        if feedback.seeking && channels.is_some() {
            seeking = true;
            seek_sent = true;
        }
        match socket.read() {
            Ok(Message::Text(text)) => {
                if text.len() > 4096 {
                    return Err("Message de fondu trop volumineux.".into());
                }
                let value: Value =
                    serde_json::from_str(&text).map_err(|_| "Message de fondu invalide.")?;
                match value["type"].as_str() {
                    // Audio already in flight is discarded after Stop; its
                    // format/EOF cannot revive the visit or fail its confirmation.
                    Some("format" | "eof") if feedback.stopped => continue,
                    Some("format") => {
                        let format = protocol::format(&value, reference, rate)?;
                        feedback.epoch = format.epoch;
                        if seeking && !seek_sent {
                            send(
                                &mut socket,
                                json!({"type":"seek","epoch":feedback.epoch,"frames":0,"position_ms":initial}),
                            )?;
                            seek_sent = true;
                            feedback.seeking = true;
                            feedback.deadline = Some(Instant::now() + Duration::from_secs(12));
                        } else if !seeking {
                            feedback.seeking = false;
                            feedback.deadline = None;
                            channels = Some(format.channels);
                            feedback.publish(&mut socket, clock, tx, Ok(Packet::Format(format)))?;
                        }
                    }
                    Some("reset") => {
                        feedback.epoch = protocol::unsigned(&value, "epoch")?;
                        channels = None;
                        sent = 0;
                        feedback.acknowledged = 0;
                        feedback.eof = None;
                        seeking = false;
                        send(
                            &mut socket,
                            json!({"type":"reset_ack","epoch":feedback.epoch}),
                        )?;
                    }
                    Some("queue" | "track" | "track_end" | "recorded") => {}
                    Some("eof") if !seeking => {
                        if protocol::unsigned(&value, "epoch")? != feedback.epoch
                            || protocol::unsigned(&value, "frames")? != sent
                        {
                            return Err("Fin du flux de fondu incohérente.".into());
                        }
                        feedback.eof = Some(sent);
                        feedback.publish(&mut socket, clock, tx, Ok(Packet::End))?;
                    }
                    Some("eof") => {}
                    Some("saved") => {
                        clock.confirmed.store(true, Ordering::Relaxed);
                    }
                    Some("error") => {
                        return Err(protocol::failure(&value));
                    }
                    _ => return Err("Message de fondu inconnu.".into()),
                }
            }
            Ok(Message::Binary(bytes)) if !seeking && !feedback.stopped => {
                let frames = protocol::pcm(&bytes, channels.ok_or("PCM avant son format.")?)?;
                sent += frames.len() as u64;
                feedback.publish(&mut socket, clock, tx, Ok(Packet::Samples(frames)))?;
            }
            Ok(Message::Binary(_)) => {}
            Ok(Message::Ping(bytes)) => socket
                .send(Message::Pong(bytes))
                .map_err(|_| "Flux de fondu interrompu.".to_owned())?,
            Ok(Message::Pong(_)) => {}
            Ok(Message::Close(_)) | Err(tungstenite::Error::ConnectionClosed) => {
                if clock.confirmed.load(Ordering::Relaxed) {
                    return Ok(());
                }
                return Err("Le serveur n’a pas confirmé cette écoute.".into());
            }
            Err(error) if socket::transient(&error) => {}
            Err(_) => return Err("Connexion du fondu interrompue.".into()),
            _ => return Err("Trame de fondu inattendue.".into()),
        }
    }
}

#[cfg(test)]
#[path = "crossfade_source_tests.rs"]
mod tests;
