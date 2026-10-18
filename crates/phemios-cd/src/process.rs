//! Bounded pipe reading owns the decoder child and kills/reaps it when the stream retires.
use std::{
    io::Read,
    process::{Child, Command, Stdio},
    sync::mpsc::{self, Receiver},
    thread,
    time::Duration,
};
pub(super) struct Process {
    child: Child,
    receive: Receiver<Result<Vec<u8>, String>>,
    pending: Vec<u8>,
    offset: usize,
}
impl Process {
    pub fn spawn(mut command: Command, block: usize) -> Result<Self, String> {
        command
            .env_remove("FFREPORT")
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        let mut child = command
            .spawn()
            .map_err(|_| "APE nécessite FFmpeg et FFprobe installés, avec le protocole fd.")?;
        let mut pipe = child
            .stdout
            .take()
            .ok_or("Sortie du décodeur indisponible.")?;
        let (send, receive) = mpsc::sync_channel(2);
        if let Err(error) = thread::Builder::new()
            .name("cd-image-pipe".into())
            .spawn(move || {
                loop {
                    let mut bytes = vec![0; block];
                    match pipe.read(&mut bytes) {
                        Ok(0) => break,
                        Ok(n) => {
                            bytes.truncate(n);
                            if send.send(Ok(bytes)).is_err() {
                                break;
                            }
                        }
                        Err(_) => {
                            let _ = send.send(Err("Lecture APE interrompue.".into()));
                            break;
                        }
                    }
                }
            })
        {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("Impossible de démarrer le décodeur : {error}"));
        }
        Ok(Self {
            child,
            receive,
            pending: Vec::new(),
            offset: 0,
        })
    }
    pub fn read(&mut self, count: usize) -> Result<Vec<u8>, String> {
        let mut bytes = Vec::with_capacity(count);
        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        while bytes.len() < count {
            if self.offset == self.pending.len() {
                self.pending = self
                    .receive
                    .recv_timeout(deadline.saturating_duration_since(std::time::Instant::now()))
                    .map_err(|_| "Décodage APE indisponible ou interrompu.")??;
                self.offset = 0;
            }
            let n = (self.pending.len() - self.offset).min(count - bytes.len());
            bytes.extend_from_slice(&self.pending[self.offset..self.offset + n]);
            self.offset += n;
        }
        Ok(bytes)
    }
    pub fn text(&mut self) -> Result<String, String> {
        let mut bytes = Vec::new();
        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        loop {
            match self
                .receive
                .recv_timeout(deadline.saturating_duration_since(std::time::Instant::now()))
            {
                Ok(data) => {
                    bytes.extend_from_slice(&data?);
                    if bytes.len() > 8192 {
                        return Err("Métadonnées APE trop volumineuses.".into());
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    return Err("L’inspection APE a expiré.".into());
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
        let status = self
            .child
            .try_wait()
            .map_err(|_| "Inspection APE impossible.")?;
        // EOF can precede process termination by a scheduler tick. Bounded wait, never wait() on a live child.
        let deadline = std::time::Instant::now() + Duration::from_secs(1);
        let mut status = status;
        while status.is_none() && std::time::Instant::now() < deadline {
            thread::sleep(Duration::from_millis(5));
            status = self
                .child
                .try_wait()
                .map_err(|_| "Inspection APE impossible.")?;
        }
        if !status.is_some_and(|s| s.success()) {
            return Err(
                "Inspection APE impossible : FFmpeg/FFprobe avec protocole fd requis.".into(),
            );
        }
        String::from_utf8(bytes).map_err(|_| "Métadonnées APE invalides.".into())
    }
}
impl Drop for Process {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[cfg(test)]
#[path = "process_tests.rs"]
mod tests;
