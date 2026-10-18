//! A bounded optical I/O worker keeps slow drive calls away from transport and CPAL.
use phemios_cd::{Chunk, Disc};
use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver},
    },
    thread::JoinHandle,
    time::Duration,
};
pub(super) enum Event {
    Pcm(u64, Chunk),
    End(u64),
    Error(String),
}
pub(super) struct Reader {
    pub received: Receiver<Event>,
    request: Arc<Mutex<(u64, u64)>>,
    cancelled: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}
impl Reader {
    pub fn new(disc: Disc, number: u8, position: u64) -> Self {
        let (send, received) = mpsc::sync_channel(2);
        let request = Arc::new(Mutex::new((0, position)));
        let cancelled = Arc::new(AtomicBool::new(false));
        let held = request.clone();
        let stop = cancelled.clone();
        let handle = std::thread::spawn(move || {
            let result = disc.with_stream(
                number,
                || !stop.load(Ordering::Acquire),
                |reader| {
                    let mut epoch = u64::MAX;
                    let mut ended = false;
                    while !stop.load(Ordering::Acquire) {
                        let (next, frame) =
                            *held.lock().map_err(|_| "Déplacement CD indisponible.")?;
                        if epoch != next {
                            reader.seek(frame)?;
                            epoch = next;
                            ended = false;
                        }
                        if ended {
                            std::thread::sleep(Duration::from_millis(2));
                            continue;
                        }
                        let mut message = match reader.next_chunk()? {
                            Some(pcm) => Event::Pcm(epoch, pcm),
                            None => {
                                ended = true;
                                Event::End(epoch)
                            }
                        };
                        loop {
                            if stop.load(Ordering::Acquire) {
                                return Ok(());
                            }
                            if held.lock().map_err(|_| "Déplacement CD indisponible.")?.0 != epoch
                            {
                                break;
                            }
                            match send.try_send(message) {
                                Ok(()) => break,
                                Err(mpsc::TrySendError::Full(retained)) => {
                                    message = retained;
                                    std::thread::sleep(Duration::from_millis(2));
                                }
                                Err(mpsc::TrySendError::Disconnected(_)) => return Ok(()),
                            }
                        }
                    }
                    Ok(())
                },
            );
            if !stop.load(Ordering::Acquire)
                && let Err(error) = result
            {
                let _ = send.send(Event::Error(error));
            }
        });
        Self {
            received,
            request,
            cancelled,
            handle: Some(handle),
        }
    }
    pub fn seek(&self, frame: u64) -> Result<u64, String> {
        let mut request = self
            .request
            .lock()
            .map_err(|_| "Déplacement CD indisponible.")?;
        request.0 = request
            .0
            .checked_add(1)
            .ok_or("Trop de déplacements dans le CD.")?;
        request.1 = frame;
        Ok(request.0)
    }
}
impl Drop for Reader {
    fn drop(&mut self) {
        self.cancelled.store(true, Ordering::Release);
        // Normal prefetch exits promptly. A blocked driver may finish later, but cannot emit audio
        // or acquire another device: the source registry retains its exclusive I/O gate.
        if let Some(handle) = self.handle.take() {
            for _ in 0..20 {
                if handle.is_finished() {
                    let _ = handle.join();
                    return;
                }
                std::thread::sleep(Duration::from_millis(1));
            }
        }
    }
}
