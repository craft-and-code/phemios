//! Continuous native output; prebuffered voices never become listening history before rendering.
use super::crossfade_mix::{VoiceSlot, audible, blend, overlap, played};
use super::crossfade_source::{Packet, Source};
use super::output::{Output, Signals};
use super::{Command, State, protocol, update};
use crate::network::Client;
use std::collections::VecDeque;
use std::sync::{
    Arc, Mutex,
    atomic::Ordering,
    mpsc::{Receiver, TryRecvError},
};
use std::time::{Duration, Instant};
struct Voice {
    source: Source,
    format: Option<protocol::Format>,
    frames: VecDeque<[f32; 2]>,
    ended: bool,
    index: usize,
    start: Option<u64>,
    supplied: u64,
}
impl Voice {
    fn open(client: &Client, tracks: &[String], index: usize, rate: u32, position: u64) -> Self {
        Self {
            source: Source::open(client, tracks[index].clone(), rate, position),
            format: None,
            frames: VecDeque::new(),
            ended: false,
            index,
            start: None,
            supplied: 0,
        }
    }
    fn poll(&mut self) -> Result<(), String> {
        while self.frames.len() < 16384 {
            match self.source.try_recv() {
                Ok(Ok(Packet::Format(format))) if self.format.is_none() => {
                    self.format = Some(format)
                }
                Ok(Ok(Packet::Samples(frames))) if self.format.is_some() && !self.ended => {
                    self.frames.extend(frames)
                }
                Ok(Ok(Packet::End)) if !self.ended => self.ended = true,
                Ok(Err(error)) => return Err(error),
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) if self.ended => break,
                Err(TryRecvError::Disconnected) => {
                    return Err("Le flux de fondu a été interrompu.".into());
                }
                _ => return Err("Séquence du fondu invalide.".into()),
            }
        }
        Ok(())
    }
    fn acknowledge(&self, consumed: u64) {
        self.source.clock.consumed.store(
            played(consumed, self.start, self.supplied),
            Ordering::Relaxed,
        );
    }
    fn position(&self, consumed: u64, rate: u32) -> u64 {
        self.format.as_ref().map_or(0, |format| format.position)
            + played(consumed, self.start, self.supplied) * 1000 / u64::from(rate)
    }
}
struct Mixer<'a> {
    client: &'a Client,
    tracks: &'a [String],
    state: &'a Mutex<State>,
    signals: &'a Arc<Signals>,
    output: Output,
    current: Voice,
    next: Option<Voice>,
    retired: Option<Voice>,
    sent: u64,
    mixing: Option<(u64, u64)>,
    progress: Instant,
    last_consumed: u64,
    seek_ticket: Option<u64>,
    pending_seek: Option<(u64, u64)>,
}
impl Mixer<'_> {
    fn audible_slot(&self, consumed: u64) -> VoiceSlot {
        audible(
            consumed,
            self.current.start,
            self.next.as_ref().and_then(|voice| voice.start),
            self.retired.is_some(),
        )
    }
    fn tick(&mut self) -> Result<(), String> {
        let consumed = self.output.consumed.load(Ordering::Relaxed);
        if consumed != self.last_consumed {
            self.progress = Instant::now();
            self.last_consumed = consumed;
        }
        for voice in [&self.current]
            .into_iter()
            .chain(self.next.iter())
            .chain(self.retired.iter())
        {
            voice.acknowledge(consumed);
        }
        let audible = match self.audible_slot(consumed) {
            VoiceSlot::Next => self.next.as_ref().ok_or("Voix du fondu indisponible.")?,
            VoiceSlot::Retired => self.retired.as_ref().ok_or("Voix du fondu indisponible.")?,
            VoiceSlot::Current => &self.current,
        };
        update(self.state, |s| {
            s.index = audible.index;
            s.reference = self.tracks[audible.index].clone();
            if let Some(format) = &audible.format {
                s.position = audible.position(consumed, self.output.rate);
                s.duration = format.duration;
            }
            s.rate = self.output.rate;
            if audible.start.is_some_and(|start| start <= consumed)
                && !self.signals.paused.load(Ordering::Relaxed)
            {
                s.status = "playing";
                if let Some(ticket) = self.seek_ticket.take() {
                    s.seek_id = ticket;
                }
            }
        })?;
        if self.output.failed.load(Ordering::Relaxed) {
            return Err("La sortie audio a été interrompue.".into());
        }
        if self.progress.elapsed() > Duration::from_secs(12) {
            return Err("Le flux de fondu ne progresse plus.".into());
        }
        if self
            .retired
            .as_ref()
            .is_some_and(|old| played(consumed, old.start, old.supplied) == old.supplied)
            && let Some(mut old) = self.retired.take()
        {
            old.source.finish()?;
        }
        Ok(())
    }
    fn successor(&self) -> Result<Option<usize>, String> {
        let state = self.state.lock().map_err(|_| "État audio indisponible.")?;
        let next = if state.repeat == "one" {
            Some(self.current.index)
        } else {
            state
                .queue
                .iter()
                .position(|index| *index == self.current.index)
                .and_then(|offset| state.queue.get(offset + 1).copied())
                .or_else(|| {
                    (state.repeat == "all")
                        .then(|| state.queue.first().copied())
                        .flatten()
                })
        };
        Ok(next)
    }
    fn prepare(&mut self, ms: u64) -> Result<(), String> {
        if self.mixing.is_some() || self.retired.is_some() {
            return Ok(());
        }
        let successor = self.successor()?;
        if self
            .next
            .as_ref()
            .is_some_and(|voice| Some(voice.index) != successor)
            && let Some(mut voice) = self.next.take()
        {
            voice.source.finish()?;
        }
        let remaining = self.current.format.as_ref().and_then(|format| {
            format.duration.map(|duration| {
                duration.saturating_sub(
                    format.position + self.current.supplied * 1000 / u64::from(self.output.rate),
                )
            })
        });
        if self.next.is_none()
            && (self.current.ended || remaining.is_some_and(|value| value <= ms + 3000))
            && let Some(index) = successor
        {
            self.next = Some(Voice::open(
                self.client,
                self.tracks,
                index,
                self.output.rate,
                0,
            ));
        }
        Ok(())
    }
    fn finish(&mut self) -> Result<(), String> {
        self.signals.paused.store(true, Ordering::Relaxed);
        self.output.freeze()?;
        self.tick()?;
        let mut failure = None;
        for voice in [&mut self.current]
            .into_iter()
            .chain(self.next.iter_mut())
            .chain(self.retired.iter_mut())
        {
            if let Err(error) = voice.source.finish() {
                failure = Some(error);
            }
        }
        if let Some(error) = failure {
            return Err(error);
        }
        update(self.state, |state| state.confirmed = true)
    }
    fn seek(&mut self, position: u64, ticket: u64) -> Result<(), String> {
        self.signals.paused.store(true, Ordering::Relaxed);
        let consumed = self.output.reset()?;
        for voice in [&self.current]
            .into_iter()
            .chain(self.next.iter())
            .chain(self.retired.iter())
        {
            voice.acknowledge(consumed);
        }
        match self.audible_slot(consumed) {
            VoiceSlot::Next => {
                let next = self.next.take().ok_or("Voix du fondu indisponible.")?;
                self.next = Some(std::mem::replace(&mut self.current, next));
            }
            VoiceSlot::Retired => {
                let old = self.retired.take().ok_or("Voix du fondu indisponible.")?;
                self.retired = Some(std::mem::replace(&mut self.current, old));
            }
            VoiceSlot::Current => {}
        }
        for voice in self.next.iter_mut().chain(self.retired.iter_mut()) {
            voice.source.finish()?;
        }
        self.current.source.seek(
            position,
            played(consumed, self.current.start, self.current.supplied),
        )?;
        self.current.format = None;
        self.current.frames.clear();
        self.current.ended = false;
        self.current.start = None;
        self.current.supplied = 0;
        self.next = None;
        self.retired = None;
        self.mixing = None;
        self.sent = 0;
        self.last_consumed = 0;
        self.progress = Instant::now();
        self.seek_ticket = Some(ticket);
        update(self.state, |s| {
            s.position = position;
            s.status = "connecting";
            s.confirmed = false;
        })
    }
    fn run(
        &mut self,
        mut ms: u64,
        commands: &Receiver<Command>,
    ) -> Result<Option<Command>, String> {
        loop {
            if self.sent.is_multiple_of(256)
                || self.current.frames.is_empty()
                || self.output.producer.slots() == 0
            {
                self.tick()?;
                match commands.try_recv() {
                    Ok(Command::Crossfade(value)) => {
                        ms = value;
                        update(self.state, |s| s.crossfade_ms = value)?;
                    }
                    Ok(Command::Seek(position, ticket)) => {
                        if self.current.format.is_some() {
                            self.seek(position, ticket)?;
                        } else {
                            self.pending_seek = Some((position, ticket));
                        }
                        continue;
                    }
                    Ok(command) => return Ok(Some(command)),
                    Err(TryRecvError::Disconnected) => return Ok(Some(Command::Stop)),
                    Err(TryRecvError::Empty) => {}
                }
                self.current.poll()?;
                if self.current.format.is_some()
                    && let Some((position, ticket)) = self.pending_seek.take()
                {
                    self.seek(position, ticket)?;
                    continue;
                }
                self.prepare(ms)?;
                if let Some(next) = &mut self.next {
                    next.poll()?;
                }
            }
            if self.current.ended && self.current.frames.is_empty() {
                if let Some(mut next) = self.next.take() {
                    next.start.get_or_insert(self.sent);
                    self.retired = Some(std::mem::replace(&mut self.current, next));
                    self.mixing = None;
                    continue;
                }
                if self.successor()?.is_some() {
                    std::thread::sleep(Duration::from_millis(2));
                    continue;
                }
                if self.output.consumed.load(Ordering::Relaxed) == self.sent {
                    return Ok(None);
                }
                std::thread::sleep(Duration::from_millis(2));
                continue;
            }
            if self.current.frames.is_empty() || self.current.format.is_none() {
                std::thread::sleep(Duration::from_millis(2));
                continue;
            }
            if self.mixing.is_none()
                && let Some(next) = &mut self.next
                && !next.frames.is_empty()
            {
                let position = self
                    .current
                    .format
                    .as_ref()
                    .map_or(0, |format| format.position);
                let duration = self
                    .current
                    .format
                    .as_ref()
                    .and_then(|format| format.duration);
                let fade = overlap(
                    ms,
                    self.output.rate,
                    duration,
                    next.format.as_ref().and_then(|format| format.duration),
                    position,
                );
                let remaining = duration
                    .map_or(u64::MAX, |duration| {
                        duration.saturating_sub(position) * u64::from(self.output.rate) / 1000
                    })
                    .saturating_sub(self.current.supplied);
                if fade > 0 && remaining <= fade {
                    next.start = Some(self.sent);
                    self.mixing = Some((0, remaining.max(1)));
                }
            }
            if self.mixing.is_some()
                && self
                    .next
                    .as_ref()
                    .is_none_or(|voice| voice.frames.is_empty())
            {
                if self.next.as_ref().is_some_and(|voice| voice.ended) {
                    return Err("Durée audio incohérente pendant le fondu.".into());
                }
                std::thread::sleep(Duration::from_millis(2));
                continue;
            }
            if self.output.producer.slots() == 0 {
                std::thread::sleep(Duration::from_millis(2));
                continue;
            }
            let Some(mut frame) = self.current.frames.pop_front() else {
                continue;
            };
            self.current.start.get_or_insert(self.sent);
            self.current.supplied += 1;
            if let Some((cursor, total)) = &mut self.mixing
                && let Some(next) = &mut self.next
                && let Some(incoming) = next.frames.pop_front()
            {
                frame = blend(frame, incoming, *cursor, *total);
                *cursor += 1;
                next.supplied += 1;
            }
            self.output
                .producer
                .push(frame)
                .map_err(|_| "Tampon du fondu indisponible.".to_owned())?;
            self.sent += 1;
            if self.sent == 1 {
                self.signals.paused.store(false, Ordering::Relaxed);
            }
        }
    }
}
pub(super) fn stream(
    client: &Client,
    tracks: &[String],
    initial: (usize, u64),
    device: &str,
    ms: u64,
    commands: &Receiver<Command>,
    state: &Mutex<State>,
    signals: &Arc<Signals>,
) -> Result<Option<Command>, String> {
    signals.paused.store(true, Ordering::Relaxed);
    let output = Output::open(device, signals.clone())?;
    let current = Voice::open(client, tracks, initial.0, output.rate, initial.1);
    let mut mixer = Mixer {
        client,
        tracks,
        state,
        signals,
        output,
        current,
        next: None,
        retired: None,
        sent: 0,
        mixing: None,
        progress: Instant::now(),
        last_consumed: 0,
        seek_ticket: None,
        pending_seek: None,
    };
    let result = mixer.run(ms, commands);
    let stopped = mixer.finish();
    result.and_then(|command| stopped.map(|()| command))
}
