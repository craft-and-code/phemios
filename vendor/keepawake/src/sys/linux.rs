//! Linux display/idle inhibition through zbus 6, owned by one private runtime.
//!
//! The synchronous builder/Drop contract stays outside audio callbacks. A live
//! Tokio worker drives both connections even while the caller is idle. Every
//! handshake/method and cleanup wait is bounded; failed acquisition rolls back.
use std::{sync::mpsc, time::Duration};
use tokio::{runtime::Runtime, time::timeout};
use zbus::{proxy, Connection, OwnedFd};

use crate::Options;
pub type Error = zbus::Error;
const ACQUIRE: Duration = Duration::from_secs(1);
const RELEASE: Duration = Duration::from_millis(500);
const CLOSE: Duration = Duration::from_millis(100);
const WAIT: Duration = Duration::from_secs(2);

#[proxy(
    interface = "org.freedesktop.login1.Manager",
    default_service = "org.freedesktop.login1",
    default_path = "/org/freedesktop/login1"
)]
trait Manager {
    async fn inhibit(&self, what: &str, who: &str, why: &str, mode: &str) -> zbus::Result<OwnedFd>;
}

#[proxy(assume_defaults = true)]
trait ScreenSaver {
    async fn inhibit(&self, application_name: &str, reason_for_inhibit: &str) -> zbus::Result<u32>;
    async fn un_inhibit(&self, cookie: u32) -> zbus::Result<()>;
}

#[derive(Default)]
struct Resources {
    session: Option<Connection>,
    system: Option<Connection>,
    cookie: Option<u32>,
    idle_fd: Option<OwnedFd>,
    sleep_fd: Option<OwnedFd>,
}

impl Resources {
    async fn acquire(&mut self, options: Options) -> zbus::Result<()> {
        if options.display {
            let connection = Connection::session().await?;
            self.session = Some(connection.clone());
            let proxy = ScreenSaverProxy::new(&connection).await?;
            self.cookie = Some(
                proxy
                    .inhibit(&options.app_reverse_domain, &options.reason)
                    .await?,
            );
        }
        if options.idle || options.sleep {
            let connection = Connection::system().await?;
            self.system = Some(connection.clone());
            let proxy = ManagerProxy::new(&connection).await?;
            if options.idle {
                self.idle_fd = Some(
                    proxy
                        .inhibit("idle", &options.app_name, &options.reason, "block")
                        .await?,
                );
            }
            if options.sleep {
                self.sleep_fd = Some(
                    proxy
                        .inhibit("sleep", &options.app_name, &options.reason, "block")
                        .await?,
                );
            }
        }
        Ok(())
    }

    async fn release(mut self) {
        // logind inhibition ends when the last owned descriptor closes.
        self.idle_fd.take();
        self.sleep_fd.take();
        if let Some(connection) = self.session.take() {
            if let Some(cookie) = self.cookie.take() {
                let result = timeout(RELEASE, async {
                    ScreenSaverProxy::new(&connection)
                        .await?
                        .un_inhibit(cookie)
                        .await
                })
                .await;
                match result {
                    Ok(Ok(())) => (),
                    Ok(Err(error)) => eprintln!("keepawake: display release failed: {error}"),
                    Err(_) => eprintln!("keepawake: display release timed out"),
                }
            }
            Self::close(connection).await;
        }
        if let Some(connection) = self.system.take() {
            Self::close(connection).await;
        }
    }

    async fn close(connection: Connection) {
        match timeout(CLOSE, connection.close()).await {
            Ok(Ok(())) => (),
            Ok(Err(error)) => eprintln!("keepawake: bus close failed: {error}"),
            Err(_) => eprintln!("keepawake: bus close timed out"),
        }
    }
}

pub struct KeepAwake {
    runtime: Option<Runtime>,
    resources: Option<Resources>,
}

impl KeepAwake {
    pub fn new(options: Options) -> Result<Self, Error> {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(1)
            .thread_name("keepawake-dbus")
            .enable_all()
            .build()?;
        let mut awake = Self {
            runtime: Some(runtime),
            resources: None,
        };
        let (send, receive) = mpsc::sync_channel(1);
        let runtime = awake
            .runtime
            .as_ref()
            .ok_or_else(|| Error::Failure("missing inhibition runtime".into()))?;
        runtime.spawn(async move {
            let mut resources = Resources::default();
            let result = match timeout(ACQUIRE, resources.acquire(options)).await {
                Ok(result) => result,
                Err(_) => Err(Error::Failure("inhibition acquisition timed out".into())),
            };
            let result = match result {
                Ok(()) => Ok(resources),
                Err(error) => {
                    resources.release().await;
                    Err(error)
                }
            };
            // A caller that stopped waiting must not leave a late guard active.
            if let Err(mpsc::SendError(Ok(resources))) = send.send(result) {
                resources.release().await;
            }
        });
        awake.resources = Some(
            receive
                .recv_timeout(WAIT)
                .map_err(|_| Error::Failure("inhibition worker did not reply".into()))??,
        );
        Ok(awake)
    }
}

impl Drop for KeepAwake {
    fn drop(&mut self) {
        if let Some(runtime) = self.runtime.take() {
            if let Some(resources) = self.resources.take() {
                let (send, receive) = mpsc::sync_channel(1);
                runtime.spawn(async move {
                    resources.release().await;
                    let _ = send.send(());
                });
                if receive.recv_timeout(WAIT).is_err() {
                    eprintln!("keepawake: cleanup worker did not reply; closing its runtime");
                }
            }
            // This nonblocking shutdown is also valid if the synchronous guard
            // is dropped from an unrelated Tokio runtime. Its worker is private.
            runtime.shutdown_background();
        }
    }
}
