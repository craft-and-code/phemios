//! Authenticated account changes cannot turn local CD playback into a supervision bypass.
use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};
pub(super) type Check = Box<dyn Fn() -> Result<(), String> + Send>;
pub(super) struct Guard(Arc<AtomicBool>);
impl Guard {
    pub(super) fn new(check: Option<Check>, failed: Option<Arc<Mutex<Option<String>>>>) -> Self {
        let cancelled = Arc::new(AtomicBool::new(false));
        if let (Some(check), Some(failed)) = (check, failed) {
            let stop = cancelled.clone();
            std::thread::spawn(move || {
                let mut next = Instant::now() + Duration::from_secs(1);
                while !stop.load(Ordering::Acquire) {
                    if Instant::now() >= next {
                        let result = check();
                        if !stop.load(Ordering::Acquire)
                            && let Err(error) = result
                        {
                            if let Ok(mut value) = failed.lock() {
                                *value = Some(error);
                            }
                            break;
                        }
                        next = Instant::now() + Duration::from_secs(3);
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
            });
        }
        Self(cancelled)
    }
}
impl Drop for Guard {
    fn drop(&mut self) {
        self.0.store(true, Ordering::Release);
    }
}
