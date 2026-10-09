use super::*;
#[test]
fn feeds_reject_credentials_files_and_non_public_addresses() {
    for value in [
        "file:///private/feed.xml",
        "https://user:secret@example.com/feed",
        "https://localhost/feed",
        "http://127.0.0.1/feed",
        "https://[::1]/feed",
        "https://10.0.0.2/feed",
        "https://example.com/feed#fragment",
    ] {
        assert!(feed_address(value).is_err(), "{value}");
    }
    assert!(feed_address("https://example.org/rss.xml?format=rss").is_ok());
    for ip in [
        "0.0.0.0",
        "10.0.0.1",
        "127.0.0.1",
        "169.254.1.1",
        "172.16.0.1",
        "192.168.1.1",
        "100.64.0.1",
        "198.18.0.1",
        "224.0.0.1",
        "::1",
        "fc00::1",
        "fe80::1",
        "::ffff:127.0.0.1",
        "2001:db8::1",
    ] {
        assert!(!public_ip(ip.parse().unwrap()), "{ip}");
    }
    for ip in ["1.1.1.1", "8.8.8.8", "2606:4700::1111"] {
        assert!(public_ip(ip.parse().unwrap()), "{ip}");
    }
}
