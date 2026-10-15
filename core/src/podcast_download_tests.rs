use super::*;
use std::io::{self, Cursor, Read};
struct Fixture(std::path::PathBuf);
impl Fixture {
    fn new() -> Self {
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        Self(std::env::temp_dir().join(format!(
            "phemios-podcast-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        )))
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
#[test]
fn streaming_publication_sanitizes_titles_and_preserves_prior_downloads() {
    let folder = Fixture::new();
    let first = publish_episode(
        &folder.0,
        "../Episode: 1",
        "mp3",
        Cursor::new(b"audio"),
        Some(5),
        10,
    )
    .unwrap();
    assert_eq!(first.parent(), Some(folder.0.as_path()));
    assert!(!first.file_name().unwrap().to_string_lossy().contains('/'));
    let second = publish_episode(
        &folder.0,
        "../Episode: 1",
        "mp3",
        Cursor::new(b"second"),
        Some(6),
        10,
    )
    .unwrap();
    assert_ne!(first, second);
    assert_eq!(std::fs::read(first).unwrap(), b"audio");
    assert_eq!(std::fs::read(second).unwrap(), b"second");
    assert_eq!(std::fs::read_dir(&folder.0).unwrap().count(), 2);
}
#[test]
fn failures_leave_no_partial_episode_or_temporary_file() {
    struct Broken;
    impl Read for Broken {
        fn read(&mut self, _: &mut [u8]) -> io::Result<usize> {
            Err(io::Error::other("interrupted"))
        }
    }
    let folder = Fixture::new();
    for (bytes, expected, limit) in [
        (b"".as_slice(), None, 10),
        (b"audio".as_slice(), Some(8), 10),
        (b"too large".as_slice(), None, 4),
    ] {
        assert!(
            publish_episode(
                &folder.0,
                "Episode",
                "mp3",
                Cursor::new(bytes),
                expected,
                limit
            )
            .is_err()
        );
    }
    assert!(publish_episode(&folder.0, "Episode", "mp3", Broken, None, 10).is_err());
    assert_eq!(std::fs::read_dir(&folder.0).unwrap().count(), 0);
}
#[test]
fn media_types_never_publish_html_or_playlist_documents_as_audio() {
    let uri = "https://example.org/episode.mp3?key=public"
        .parse()
        .unwrap();
    assert_eq!(media_extension("audio/mpeg", &uri).unwrap(), "mp3");
    assert_eq!(
        media_extension("application/octet-stream", &uri).unwrap(),
        "mp3"
    );
    assert!(media_extension("text/html", &uri).is_err());
    assert!(media_extension("application/vnd.apple.mpegurl", &uri).is_err());
    assert!(
        media_extension(
            "application/octet-stream",
            &"https://example.org/program.exe".parse().unwrap()
        )
        .is_err()
    );
}

#[derive(Debug)]
struct FixtureResolver(std::net::SocketAddr);
impl ureq::unversioned::resolver::Resolver for FixtureResolver {
    fn resolve(
        &self,
        _: &Uri,
        _: &ureq::config::Config,
        _: ureq::unversioned::transport::NextTimeout,
    ) -> Result<ureq::unversioned::resolver::ResolvedSocketAddrs, ureq::Error> {
        let mut addresses = self.empty();
        addresses.push(self.0);
        Ok(addresses)
    }
}
fn http_fixture(responses: Vec<&'static str>) -> (ureq::Agent, std::thread::JoinHandle<()>) {
    use std::io::Write;
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let config = ureq::Agent::config_builder()
        .proxy(None)
        .max_redirects(5)
        .timeout_global(Some(Duration::from_secs(3)))
        .build();
    let agent = ureq::Agent::with_parts(
        config,
        DefaultConnector::default(),
        FixtureResolver(listener.local_addr().unwrap()),
    );
    let server = std::thread::spawn(move || {
        for response in responses {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            let mut request = Vec::new();
            loop {
                let mut byte = [0];
                stream.read_exact(&mut byte).unwrap();
                request.push(byte[0]);
                if request.ends_with(b"\r\n\r\n") {
                    break;
                }
            }
            let headers = String::from_utf8(request).unwrap().to_ascii_lowercase();
            assert!(!headers.contains("authorization:"));
            assert!(!headers.contains("cookie:"));
            stream.write_all(response.as_bytes()).unwrap();
        }
    });
    (agent, server)
}
#[test]
fn http_redirect_download_streams_complete_media_without_session_headers() {
    let folder = Fixture::new();
    let (agent, server) = http_fixture(vec![
        "HTTP/1.1 302 Found\r\nLocation: http://cdn.example.org/episode.mp3\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
        "HTTP/1.1 200 OK\r\nContent-Type: audio/mpeg\r\nContent-Length: 5\r\nConnection: close\r\n\r\naudio",
    ]);
    let path = download_with(
        &agent,
        &folder.0,
        "http://example.org/episode.mp3",
        "Network episode",
    )
    .unwrap();
    server.join().unwrap();
    assert_eq!(std::fs::read(path).unwrap(), b"audio");
}
#[test]
fn http_truncation_and_html_errors_do_not_leave_downloads() {
    for response in [
        "HTTP/1.1 206 Partial Content\r\nContent-Type: audio/mpeg\r\nContent-Length: 5\r\nConnection: close\r\n\r\nshort",
        "HTTP/1.1 200 OK\r\nContent-Type: audio/mpeg\r\nContent-Length: 100\r\nConnection: close\r\n\r\nshort",
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 5\r\nConnection: close\r\n\r\nerror",
    ] {
        let folder = Fixture::new();
        let (agent, server) = http_fixture(vec![response]);
        assert!(
            download_with(
                &agent,
                &folder.0,
                "http://example.org/episode.mp3",
                "Broken episode"
            )
            .is_err()
        );
        server.join().unwrap();
        assert!(!folder.0.exists() || std::fs::read_dir(&folder.0).unwrap().count() == 0);
    }
}

#[test]
fn revoked_download_publication_leaves_no_final_or_partial_episode() {
    let folder = Fixture::new();
    let result = publish_authorized(
        &folder.0,
        "private episode",
        "mp3",
        &b"audio"[..],
        Some(5),
        10,
        || Err("session replaced".into()),
    );
    assert_eq!(result.unwrap_err(), "session replaced");
    assert_eq!(std::fs::read_dir(&folder.0).unwrap().count(), 0);
}
