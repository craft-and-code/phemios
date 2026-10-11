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

#[test]
fn feeds_refuse_special_protocol_ranges_and_keep_globally_reachable_anycast_exceptions() {
    for ip in [
        "192.0.0.0",
        "192.0.0.1",
        "192.0.0.8",
        "192.0.0.170",
        "192.0.0.171",
        "192.0.0.255",
        "192.88.99.1",
        "192.88.99.2",
    ] {
        assert!(!public_ip(ip.parse().unwrap()), "{ip}");
        assert!(feed_address(&format!("https://{ip}/feed")).is_err(), "{ip}");
        assert!(
            feed_address(&format!("https://[::ffff:{ip}]/feed")).is_err(),
            "{ip}"
        );
    }
    for ip in ["192.0.0.9", "192.0.0.10"] {
        assert!(public_ip(ip.parse().unwrap()), "{ip}");
        assert!(feed_address(&format!("https://{ip}/feed")).is_ok(), "{ip}");
    }
}
