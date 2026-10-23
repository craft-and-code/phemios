use super::Options;
use std::{
    io::{ErrorKind, Read},
    os::unix::net::UnixStream,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tokio::runtime::Runtime;

#[derive(Default)]
pub(super) struct State {
    pub(super) events: Mutex<Vec<String>>,
    pub(super) peers: Mutex<Vec<UnixStream>>,
    pub(super) owners: Mutex<Vec<String>>,
    pub(super) fail_idle: AtomicBool,
    pub(super) fail_sleep: AtomicBool,
    pub(super) fail_release: AtomicBool,
    pub(super) acquire_delay: AtomicU64,
    pub(super) release_delay: AtomicU64,
}
struct Screen(Arc<State>);
#[zbus::interface(name = "org.freedesktop.ScreenSaver")]
impl Screen {
    async fn inhibit(
        &self,
        app: &str,
        reason: &str,
        #[zbus(header)] header: zbus::message::Header<'_>,
    ) -> zbus::fdo::Result<u32> {
        self.0
            .owners
            .lock()
            .unwrap()
            .push(header.sender().unwrap().to_string());
        self.0
            .events
            .lock()
            .unwrap()
            .push(format!("display:{app}:{reason}"));
        tokio::time::sleep(Duration::from_millis(
            self.0.acquire_delay.load(Ordering::SeqCst),
        ))
        .await;
        Ok(42)
    }
    async fn un_inhibit(&self, cookie: u32) -> zbus::fdo::Result<()> {
        self.0
            .events
            .lock()
            .unwrap()
            .push(format!("release:{cookie}"));
        tokio::time::sleep(Duration::from_millis(
            self.0.release_delay.load(Ordering::SeqCst),
        ))
        .await;
        if self.0.fail_release.load(Ordering::SeqCst) {
            Err(zbus::fdo::Error::Failed("fixture release refused".into()))
        } else {
            Ok(())
        }
    }
}
struct Manager(Arc<State>);
#[zbus::interface(name = "org.freedesktop.login1.Manager")]
impl Manager {
    async fn inhibit(
        &self,
        what: &str,
        who: &str,
        why: &str,
        mode: &str,
    ) -> zbus::fdo::Result<super::TestFd> {
        self.0
            .events
            .lock()
            .unwrap()
            .push(format!("system:{what}:{who}:{why}:{mode}"));
        if self.0.fail_idle.load(Ordering::SeqCst)
            || (what == "sleep" && self.0.fail_sleep.load(Ordering::SeqCst))
        {
            return Err(zbus::fdo::Error::AccessDenied(
                "fixture system inhibition refused".into(),
            ));
        }
        let (fd, peer) = UnixStream::pair().unwrap();
        peer.set_nonblocking(true).unwrap();
        self.0.peers.lock().unwrap().push(peer);
        let owned: std::os::fd::OwnedFd = fd.into();
        Ok(owned.into())
    }
}
pub(super) struct Fixture {
    pub(super) state: Arc<State>,
    pub(super) session: zbus::Connection,
    _system: zbus::Connection,
    pub(super) runtime: Runtime,
}
impl Fixture {
    pub(super) fn new() -> Self {
        assert_eq!(
            std::env::var("PHEMIOS_PRIVATE_DBUS").as_deref(),
            Ok("1"),
            "use the private-bus test runner"
        );
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .unwrap();
        let state = Arc::new(State::default());
        let (session, system) = runtime.block_on(async {
            let session = zbus::Connection::session().await.unwrap();
            session
                .object_server()
                .at("/org/freedesktop/ScreenSaver", Screen(state.clone()))
                .await
                .unwrap();
            session
                .request_name("org.freedesktop.ScreenSaver")
                .await
                .unwrap();
            // For the authentication-stall case only the session fixture is needed.
            let system = if std::env::var_os("PHEMIOS_BLACKHOLE_BUS").is_some() {
                session.clone()
            } else {
                let connection = zbus::Connection::system().await.unwrap();
                connection
                    .object_server()
                    .at("/org/freedesktop/login1", Manager(state.clone()))
                    .await
                    .unwrap();
                connection
                    .request_name("org.freedesktop.login1")
                    .await
                    .unwrap();
                connection
            };
            (session, system)
        });
        Self {
            state,
            session,
            _system: system,
            runtime,
        }
    }
    pub(super) fn events(&self) -> Vec<String> {
        self.state.events.lock().unwrap().clone()
    }
    pub(super) fn assert_fds(&self, closed: bool) {
        for peer in self.state.peers.lock().unwrap().iter_mut() {
            let start = Instant::now();
            loop {
                match peer.read(&mut [0]) {
                    Ok(0) if closed => break,
                    Err(error) if error.kind() == ErrorKind::WouldBlock => {
                        if !closed {
                            break;
                        }
                        assert!(
                            start.elapsed() < Duration::from_millis(500),
                            "logind descriptor must close"
                        );
                        std::thread::sleep(Duration::from_millis(5));
                    }
                    result => panic!("unexpected descriptor state: {result:?}"),
                }
            }
        }
    }
    fn assert_clients(&self, expected: bool) {
        let owners = self.state.owners.lock().unwrap().clone();
        for owner in owners {
            let start = Instant::now();
            loop {
                let alive = self.runtime.block_on(async {
                    self.session
                        .call_method(
                            Some("org.freedesktop.DBus"),
                            "/org/freedesktop/DBus",
                            Some("org.freedesktop.DBus"),
                            "NameHasOwner",
                            &(&owner,),
                        )
                        .await
                        .unwrap()
                        .body()
                        .deserialize::<bool>()
                        .unwrap()
                });
                if alive == expected {
                    break;
                }
                assert!(
                    start.elapsed() < Duration::from_millis(500),
                    "client {owner} presence must become {expected}"
                );
                std::thread::sleep(Duration::from_millis(5));
            }
        }
    }
    pub(super) fn assert_clients_closed(&self) {
        self.assert_clients(false);
    }
    pub(super) fn assert_clients_alive(&self) {
        self.assert_clients(true);
    }
}
pub(super) fn options() -> Options {
    Options {
        display: true,
        idle: true,
        sleep: false,
        reason: "Fixture playback".into(),
        app_name: "Fixture player".into(),
        app_reverse_domain: "org.example.fixture".into(),
    }
}
