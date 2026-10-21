//! Loopback XML endpoint for actual native HQPlayer routing; no hardware or external service.
use std::{
    io::{Read, Write},
    net::TcpListener,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
    thread::{self, JoinHandle},
    time::Duration,
};
pub(super) struct Endpoint {
    pub port: u16,
    pub connections: Arc<AtomicUsize>,
    stop: Arc<AtomicBool>,
    hold: Arc<AtomicBool>,
    queried: Arc<AtomicBool>,
    worker: Option<JoinHandle<()>>,
}
impl Endpoint {
    pub fn new(name: &'static str) -> Self {
        Self::with_reply(name, false)
    }
    pub fn stalled(name: &'static str) -> Self {
        Self::with_reply(name, true)
    }
    fn with_reply(name: &'static str, stalled: bool) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").expect("fixture endpoint");
        let port = listener.local_addr().expect("address").port();
        listener.set_nonblocking(true).expect("bounded accept");
        let stop = Arc::new(AtomicBool::new(false));
        let connections = Arc::new(AtomicUsize::new(0));
        let hold = Arc::new(AtomicBool::new(stalled));
        let queried = Arc::new(AtomicBool::new(false));
        let pending = hold.clone();
        let entered = queried.clone();
        let ending = stop.clone();
        let count = connections.clone();
        let worker = thread::spawn(move || {
            while !ending.load(Ordering::SeqCst) {
                let (mut socket, _) = match listener.accept() {
                    Ok(value) => value,
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(2));
                        continue;
                    }
                    Err(e) => panic!("fixture accept: {e}"),
                };
                count.fetch_add(1, Ordering::SeqCst);
                socket
                    .set_read_timeout(Some(Duration::from_millis(30)))
                    .expect("read deadline");
                socket
                    .set_write_timeout(Some(Duration::from_secs(1)))
                    .expect("write deadline");
                let mut frame = Vec::new();
                while !ending.load(Ordering::SeqCst) {
                    let mut byte = [0];
                    match socket.read(&mut byte) {
                        Ok(0) => break,
                        Ok(_) => frame.push(byte[0]),
                        Err(e)
                            if matches!(
                                e.kind(),
                                std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                            ) =>
                        {
                            continue;
                        }
                        Err(e) => panic!("fixture read: {e}"),
                    }
                    assert!(frame.len() < 65536);
                    if !frame.ends_with(b"/>") {
                        continue;
                    }
                    let xml = String::from_utf8(std::mem::take(&mut frame)).expect("XML");
                    let command = xml
                        .split("?>")
                        .last()
                        .expect("command")
                        .trim_start_matches('<');
                    let command = command.split([' ', '/']).next().expect("name");
                    if command == "GetInfo" {
                        entered.store(true, Ordering::SeqCst);
                        while pending.load(Ordering::SeqCst) && !ending.load(Ordering::SeqCst) {
                            thread::sleep(Duration::from_millis(2));
                        }
                        if ending.load(Ordering::SeqCst) {
                            return;
                        }
                    }
                    let reply = match command {
                        "GetInfo" => format!(
                            "<GetInfo name=\"{name}\" product=\"HQPlayer Desktop\" version=\"6.0.1\"/>"
                        ),
                        "VolumeRange" => {
                            "<VolumeRange min=\"-60\" max=\"0\" enabled=\"1\"/>".into()
                        }
                        "Status" => "<Status state=\"0\"/>".into(),
                        _ => panic!("unexpected fixture operation {command}"),
                    };
                    socket.write_all(reply.as_bytes()).expect("fixture reply");
                }
            }
        });
        Self {
            port,
            connections,
            stop,
            hold,
            queried,
            worker: Some(worker),
        }
    }
    pub fn wait_until_queried(&self) {
        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        while !self.queried.load(Ordering::SeqCst) {
            assert!(
                std::time::Instant::now() < deadline,
                "fixture was not contacted"
            );
            thread::sleep(Duration::from_millis(2));
        }
    }
    pub fn resume_reply(&self) {
        self.hold.store(false, Ordering::SeqCst);
    }
}
impl Drop for Endpoint {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(worker) = self.worker.take() {
            worker.join().expect("fixture worker");
        }
    }
}
