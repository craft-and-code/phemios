//! Scoped display inhibition on a dedicated thread, away from audio callbacks and the UI.
use std::{
    sync::{
        OnceLock,
        mpsc::{self, SyncSender},
    },
    time::{Duration, Instant},
};
const TTL: Duration = Duration::from_secs(12);
const UNAVAILABLE: &str = "Maintien de l’écran indisponible sur ce système.";
pub(crate) struct Awake {
    sender: OnceLock<Result<SyncSender<Message>, String>>,
}
enum Message {
    Open(SyncSender<Result<u64, String>>),
    Update(u64, bool, SyncSender<Result<(), String>>),
}
struct Lease<G> {
    scope: u64,
    guard: Option<G>,
    expires: Option<Instant>,
}
impl<G> Default for Lease<G> {
    fn default() -> Self {
        Self {
            scope: 0,
            guard: None,
            expires: None,
        }
    }
}
impl<G> Lease<G> {
    fn open(&mut self) -> Result<u64, String> {
        let next = self.scope.checked_add(1).ok_or(UNAVAILABLE)?;
        self.guard = None;
        self.expires = None;
        self.scope = next;
        Ok(next)
    }
    fn update(
        &mut self,
        scope: u64,
        active: bool,
        now: Instant,
        create: impl FnOnce() -> Result<G, String>,
    ) -> Result<(), String> {
        if scope == 0 || scope != self.scope {
            return Err("Demande de maintien de l’écran expirée.".into());
        }
        if active {
            if self.guard.is_none() {
                self.guard = Some(create()?);
            }
            self.expires = Some(now + TTL);
        } else {
            self.guard = None;
            self.expires = None;
        }
        Ok(())
    }
    fn expire(&mut self, now: Instant) {
        if self.expires.is_some_and(|end| end <= now) {
            self.guard = None;
            self.expires = None;
        }
    }
}
fn acquire() -> Result<keepawake::KeepAwake, String> {
    keepawake::Builder::default()
        .display(true)
        .idle(true)
        .sleep(false)
        .app_name("Phémios")
        .app_reverse_domain("fr.craftandcode.phemios")
        .reason("Phemios audio playback")
        .create()
        .map_err(|_| UNAVAILABLE.into())
}
impl Awake {
    pub(crate) fn new() -> Self {
        Self {
            sender: OnceLock::new(),
        }
    }
    fn channel(&self) -> Result<&SyncSender<Message>, String> {
        self.sender
            .get_or_init(Self::start)
            .as_ref()
            .map_err(Clone::clone)
    }
    fn start() -> Result<SyncSender<Message>, String> {
        let (sender, receiver) = mpsc::sync_channel(16);
        std::thread::Builder::new()
            .name("phemios-display-awake".into())
            .spawn(move || {
                let mut lease = Lease::default();
                loop {
                    lease.expire(Instant::now());
                    let message = if let Some(end) = lease.expires {
                        match receiver.recv_timeout(end.saturating_duration_since(Instant::now())) {
                            Ok(message) => message,
                            Err(mpsc::RecvTimeoutError::Timeout) => continue,
                            Err(mpsc::RecvTimeoutError::Disconnected) => break,
                        }
                    } else {
                        match receiver.recv() {
                            Ok(message) => message,
                            Err(_) => break,
                        }
                    };
                    match message {
                        Message::Open(reply) => {
                            let _ = reply.send(lease.open());
                        }
                        Message::Update(scope, active, reply) => {
                            let _ =
                                reply.send(lease.update(scope, active, Instant::now(), acquire));
                        }
                    }
                }
            })
            .map_err(|_| UNAVAILABLE)?;
        Ok(sender)
    }
    pub(crate) fn open(&self) -> Result<String, String> {
        let (tx, rx) = mpsc::sync_channel(1);
        self.channel()?
            .try_send(Message::Open(tx))
            .map_err(|_| UNAVAILABLE)?;
        rx.recv_timeout(Duration::from_secs(3))
            .map_err(|_| UNAVAILABLE)?
            .map(|scope| scope.to_string())
    }
    pub(crate) fn update(&self, scope: &str, active: bool) -> Result<(), String> {
        if scope.len() > 20 {
            return Err(UNAVAILABLE.into());
        }
        let scope = scope.parse::<u64>().map_err(|_| UNAVAILABLE)?;
        let (tx, rx) = mpsc::sync_channel(1);
        self.channel()?
            .try_send(Message::Update(scope, active, tx))
            .map_err(|_| UNAVAILABLE)?;
        rx.recv_timeout(Duration::from_secs(3))
            .map_err(|_| UNAVAILABLE)?
    }
}
#[cfg(test)]
#[path = "display_awake_tests.rs"]
mod tests;
