//! Two independently authenticated visits; ACKs count each voice actually rendered.
use super::{Policy, protocol, socket};
use crate::network::Client;
use serde_json::{Value, json};
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicU64, Ordering},
    mpsc::{self, Receiver, SyncSender, TrySendError},
};
use std::time::{Duration, Instant};
use tungstenite::Message;

pub(super) enum Packet {
    Format(protocol::Format),
    Samples(Vec<[f32; 2]>),
    End,
}
pub(super) struct Clock {
    pub consumed: AtomicU64,
    pub stop: AtomicBool,
    pub confirmed: AtomicBool,
}
pub(super) struct Source {
    pub packets: Receiver<Result<Packet, String>>,
    pub clock: Arc<Clock>,
    handle: Option<std::thread::JoinHandle<Result<(), String>>>,
}
impl Source {
    pub fn open(client: &Client, reference: String, rate: u32, initial: u64) -> Self {
        let client = client.clone();
        let (tx, packets) = mpsc::sync_channel(4);
        let clock = Arc::new(Clock {
            consumed: AtomicU64::new(0),
            stop: AtomicBool::new(false),
            confirmed: AtomicBool::new(false),
        });
        let held = clock.clone();
        let handle = std::thread::spawn(move || {
            let result = pump(&client, &reference, rate, initial, &tx, &held);
            if let Err(error) = &result {
                let _ = tx.try_send(Err(error.clone()));
            }
            result
        });
        Self {
            packets,
            clock,
            handle: Some(handle),
        }
    }
    pub fn finish(&mut self) -> Result<(), String> {
        self.clock.stop.store(true, Ordering::Relaxed);
        if let Some(handle) = self.handle.take() {
            handle
                .join()
                .map_err(|_| "Arrêt du flux de fondu interrompu.".to_owned())??;
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
struct Feedback {
    epoch: u64,
    acknowledged: u64,
    last: Instant,
    eof: Option<u64>,
    stopped: bool,
    deadline: Option<Instant>,
}
impl Feedback {
    fn tick(&mut self, socket: &mut socket::Socket, clock: &Clock) -> Result<(), String> {
        let frames = clock.consumed.load(Ordering::Relaxed);
        if clock.stop.load(Ordering::Relaxed) && !self.stopped {
            send(
                socket,
                json!({"type":"stop","epoch":self.epoch,"frames":frames}),
            )?;
            self.stopped = true;
            self.deadline = Some(Instant::now() + Duration::from_secs(12));
        } else if !self.stopped
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
    fn publish(
        &mut self,
        socket: &mut socket::Socket,
        clock: &Clock,
        tx: &SyncSender<Result<Packet, String>>,
        mut packet: Result<Packet, String>,
    ) -> Result<bool, String> {
        loop {
            self.tick(socket, clock)?;
            if self.stopped {
                return Ok(false);
            }
            match tx.try_send(packet) {
                Ok(()) => return Ok(true),
                Err(TrySendError::Disconnected(_)) => {
                    clock.stop.store(true, Ordering::Relaxed);
                    return Ok(false);
                }
                Err(TrySendError::Full(value)) => packet = value,
            }
            std::thread::sleep(Duration::from_millis(2));
        }
    }
}
fn pump(
    client: &Client,
    reference: &str,
    rate: u32,
    initial: u64,
    tx: &SyncSender<Result<Packet, String>>,
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
        match socket.read() {
            Ok(Message::Text(text)) => {
                if text.len() > 4096 {
                    return Err("Message de fondu trop volumineux.".into());
                }
                let value: Value =
                    serde_json::from_str(&text).map_err(|_| "Message de fondu invalide.")?;
                match value["type"].as_str() {
                    Some("format") => {
                        let format = protocol::format(&value, reference, rate)?;
                        feedback.epoch = format.epoch;
                        if seeking && !seek_sent {
                            send(
                                &mut socket,
                                json!({"type":"seek","epoch":feedback.epoch,"frames":0,"position_ms":initial}),
                            )?;
                            seek_sent = true;
                        } else if !seeking {
                            channels = Some(format.channels);
                            feedback.publish(&mut socket, clock, tx, Ok(Packet::Format(format)))?;
                        }
                    }
                    Some("reset") => {
                        feedback.epoch = protocol::unsigned(&value, "epoch")?;
                        channels = None;
                        sent = 0;
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
