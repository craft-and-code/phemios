use super::output::{Output, Signals};
use super::{Command, State, protocol, socket, update};
use crate::network::Client;
use serde_json::{Value, json};
use std::sync::{
    Arc, Mutex,
    atomic::Ordering,
    mpsc::{self, Receiver},
};
use std::time::{Duration, Instant};
use tungstenite::Message;
fn send(socket: &mut socket::Socket, value: Value) -> Result<(), String> {
    socket
        .send(Message::Text(value.to_string()))
        .map_err(|_| "Commande audio interrompue.".into())
}
fn stop(
    socket: &mut socket::Socket,
    epoch: u64,
    frames: u64,
    state: &Mutex<State>,
) -> Result<(), String> {
    send(socket, json!({"type":"stop","epoch":epoch,"frames":frames}))?;
    let mut saved = false;
    let deadline = Instant::now() + Duration::from_secs(12);
    while Instant::now() < deadline {
        match socket.read() {
            Ok(Message::Text(text)) => {
                if text.len() > 4096 {
                    return Err("Message de confirmation trop volumineux.".into());
                }
                let value: Value =
                    serde_json::from_str(&text).map_err(|_| "Confirmation audio invalide.")?;
                if value["type"] == "saved" {
                    saved = true;
                    update(state, |s| s.confirmed = true)?;
                }
                if value["type"] == "error" {
                    return Err("Aède n’a pas confirmé l’enregistrement de cette écoute.".into());
                }
            }
            Ok(Message::Close(_)) | Err(tungstenite::Error::ConnectionClosed) => break,
            Err(error) if socket::transient(&error) => {}
            Err(_) => break,
            _ => {}
        }
    }
    let _ = socket.close(None);
    if saved {
        Ok(())
    } else {
        Err("Confirmation de l’écoute absente ; son enregistrement reste incertain.".into())
    }
}
pub(super) fn stream(
    client: &Client,
    reference: &str,
    initial: u64,
    output_settings: (&str, super::Policy),
    commands: &Receiver<Command>,
    state: &Mutex<State>,
    signals: &Arc<Signals>,
) -> Result<Option<Command>, String> {
    let (device, policy) = output_settings;
    signals.paused.store(true, Ordering::Relaxed);
    let mut output = Output::open(device, signals.clone())?;
    let mut socket = socket::connect(client)?;
    socket
        .send(Message::Text(protocol::start(
            reference,
            output.rate,
            policy,
        )?))
        .map_err(|_| "Lancement audio interrompu.")?;
    let mut epoch = 0;
    let mut channels = None;
    let mut seeking = initial > 0;
    let mut seek_sent = false;
    let mut offset = initial;
    let mut eof = None;
    let mut sent_frames = 0;
    let mut acknowledged = 0;
    let mut progress = Instant::now();
    let mut ack_time = Instant::now();
    let mut final_ack = false;
    loop {
        let consumed = output.consumed.load(Ordering::Relaxed);
        update(state, |s| {
            s.position = offset + consumed.saturating_mul(1000) / u64::from(output.rate);
            s.rate = output.rate;
        })?;
        match commands.try_recv() {
            Ok(command) => {
                signals.paused.store(true, Ordering::Relaxed);
                output.freeze()?;
                let consumed = output.consumed.load(Ordering::Relaxed);
                update(state, |s| {
                    s.position = offset + consumed.saturating_mul(1000) / u64::from(output.rate)
                })?;
                stop(&mut socket, epoch, consumed, state)?;
                return Ok(Some(command));
            }
            Err(mpsc::TryRecvError::Disconnected) => return Ok(Some(Command::Stop)),
            Err(mpsc::TryRecvError::Empty) => {}
        }
        if output.failed.load(Ordering::Relaxed) {
            return Err("La sortie audio a signalé une erreur ou une déconnexion.".into());
        }
        if (consumed > acknowledged && ack_time.elapsed() >= Duration::from_millis(50))
            || (eof == Some(consumed) && !final_ack)
        {
            send(
                &mut socket,
                json!({"type":"ack","epoch":epoch,"frames":consumed}),
            )?;
            acknowledged = consumed;
            ack_time = Instant::now();
            final_ack = eof == Some(consumed);
            progress = Instant::now();
        }
        if progress.elapsed() > Duration::from_secs(12) {
            return Err("Le flux audio Aède ne progresse plus.".into());
        }
        match socket.read() {
            Ok(Message::Text(text)) => {
                if text.len() > 4096 {
                    return Err("Message audio Aède trop volumineux.".into());
                }
                let value: Value =
                    serde_json::from_str(&text).map_err(|_| "Message audio Aède invalide.")?;
                match value["type"].as_str() {
                    Some("format") => {
                        let format = protocol::format(&value, reference, output.rate)?;
                        channels = Some(format.channels);
                        epoch = format.epoch;
                        update(state, |s| s.duration = format.duration)?;
                        if seeking && !seek_sent {
                            send(
                                &mut socket,
                                json!({"type":"seek","epoch":epoch,"frames":0,"position_ms":initial}),
                            )?;
                            seek_sent = true;
                        } else if !seeking {
                            offset = format.position;
                            signals.paused.store(false, Ordering::Relaxed);
                            update(state, |s| s.status = "playing")?;
                        }
                    }
                    Some("reset") => {
                        epoch = protocol::unsigned(&value, "epoch")?;
                        offset = protocol::unsigned(&value, "position_ms")?;
                        seeking = false;
                        channels = None;
                        send(&mut socket, json!({"type":"reset_ack","epoch":epoch}))?;
                        progress = Instant::now();
                    }
                    Some("queue" | "track" | "track_end") => {}
                    Some("eof") => {
                        if seeking {
                            continue;
                        }
                        if protocol::unsigned(&value, "epoch")? != epoch {
                            return Err("Époque audio incohérente.".into());
                        }
                        eof = Some(protocol::unsigned(&value, "frames")?);
                        if eof != Some(sent_frames) {
                            return Err("Fin PCM Aède incohérente.".into());
                        }
                    }
                    Some("recorded") => {
                        update(state, |s| s.confirmed = true)?;
                    }
                    Some("saved") => {
                        update(state, |s| s.confirmed = true)?;
                    }
                    Some("error") => {
                        return Err(format!(
                            "Lecture Aède refusée : {}",
                            value["message"].as_str().unwrap_or("erreur du serveur")
                        ));
                    }
                    _ => return Err("Message audio Aède inconnu.".into()),
                }
            }
            Ok(Message::Binary(bytes)) => {
                if seeking {
                    continue;
                }
                let channels = channels.ok_or("PCM reçu avant son format.")?;
                let frames = protocol::pcm(&bytes, channels)?;
                sent_frames += frames.len() as u64;
                for mut frame in frames {
                    loop {
                        match output.producer.push(frame) {
                            Ok(()) => break,
                            Err(rtrb::PushError::Full(value)) => frame = value,
                        }
                        if output.failed.load(Ordering::Relaxed) {
                            return Err("La sortie audio a signalé une erreur.".into());
                        }
                        if progress.elapsed() > Duration::from_secs(12) {
                            return Err("La sortie audio ne consomme plus le flux.".into());
                        }
                        if signals.paused.load(Ordering::Relaxed) {
                            break;
                        }
                        std::thread::sleep(Duration::from_millis(2));
                    }
                }
            }
            Ok(Message::Ping(bytes)) => {
                socket
                    .send(Message::Pong(bytes))
                    .map_err(|_| "Flux audio interrompu.")?;
            }
            Ok(Message::Pong(_)) => {}
            Ok(Message::Close(_)) | Err(tungstenite::Error::ConnectionClosed) => {
                if eof.is_some()
                    && eof == Some(output.consumed.load(Ordering::Relaxed))
                    && state
                        .lock()
                        .map_err(|_| "État audio indisponible.")?
                        .confirmed
                {
                    return Ok(None);
                }
                return Err("Le flux audio a été fermé avant sa fin.".into());
            }
            Err(error) if socket::transient(&error) => {}
            Err(_) => return Err("Connexion audio interrompue.".into()),
            _ => return Err("Trame audio inattendue.".into()),
        }
    }
}
