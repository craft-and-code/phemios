use super::*;
use serde_json::json;
fn event(name: &str, id: &str) -> Value {
    json!({"identifier":"jambase:event-one","name":"Example Live","url":"https://www.jambase.com/show/example",
 "startDate":"2027-05-02T20:00:00","eventStatus":"scheduled",
 "performer":[{"identifier":id,"name":name}],"location":{"name":"Example Hall","address":{"addressLocality":"Paris","addressCountry":{"name":"France","identifier":"FR"},"x-timezone":"Europe/Paris"}}})
}
fn page(rows: Value) -> Value {
    json!({"success":true,"pagination":{"page":1,"totalPages":1},"events":rows})
}
#[test]
fn exact_performer_matches_exclude_names_only_mentioned_in_event_titles() {
    let result = projection::project(
        &page(json!([
            event("Example Artist", "one"),
            event("Example Tribute", "two")
        ])),
        "example artist",
        0,
    )
    .unwrap();
    assert_eq!(result["items"].as_array().unwrap().len(), 1);
    assert_eq!(result["items"][0]["venue"], "Example Hall");
    assert_eq!(result["items"][0]["country"], "France");
    assert_eq!(result["items"][0]["time"], "20:00:00");
    assert_eq!(result["source"], "JamBase");
}
#[test]
fn ambiguous_provider_identities_and_unexpected_pages_are_refused() {
    let value = page(json!([
        event("Example Artist", "one"),
        event("Example Artist", "two")
    ]));
    assert!(projection::project(&value, "example artist", 0).is_err());
    assert!(projection::project(&value, "example artist", 1).is_err());
    assert!(projection::project(&json!({}), "example artist", 0).is_err());
}
#[test]
fn unsupported_links_are_not_forwarded_and_undated_events_remain_explicit() {
    let mut row = event("Example Artist", "one");
    row["url"] = json!("javascript:alert(1)");
    row["startDate"] = Value::Null;
    let result = projection::project(&page(json!([row])), "example artist", 0).unwrap();
    assert_eq!(result["items"][0]["url"], Value::Null);
    assert_eq!(result["items"][0]["date"], Value::Null);
}
#[test]
fn configuration_and_queries_reject_invalid_keys_and_bounds_without_network() {
    for key in ["", "secret?key", "line\nsecret"] {
        assert!(validate_query(key, "Example Artist", 0).is_err());
    }
    assert!(validate_query("jbd_abcdefghijklmnop", "Example Artist", 0).is_ok());
    for artist in ["", "Artist|Another", "Artist\n"] {
        assert!(validate_query("jbd_abcdefghijklmnop", artist, 0).is_err());
    }
    assert!(validate_query("jbd_abcdefghijklmnop", "Example Artist", 10).is_err());
}
#[test]
fn shared_quota_unavailability_overage_and_ceiling_fail_closed() {
    assert!(quota_allows(&json!({})).is_err());
    let mut value = json!({"usedCalls":999,"remainingCalls":1,"quota":1000,"overageCalls":0,"noMonthlyCap":false,"periodStart":"2026-10-01T00:00:00.000Z","periodEnd":"2026-11-01T00:00:00.000Z"});
    assert!(quota_allows(&value).is_ok());
    value["usedCalls"] = json!(1000);
    assert!(quota_allows(&value).is_err());
    value["usedCalls"] = json!(999);
    value["remainingCalls"] = json!(2);
    assert!(quota_allows(&value).is_err());
    value["remainingCalls"] = json!(1);
    value["overageCalls"] = json!(1);
    assert!(quota_allows(&value).is_err());
}

#[test]
fn real_http_sends_bearer_only_in_headers_and_maps_one_based_pages() {
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let peer = thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        let mut bytes = Vec::new();
        while !bytes.ends_with(b"\r\n\r\n") {
            let mut byte = [0];
            socket.read_exact(&mut byte).unwrap();
            bytes.push(byte[0]);
            assert!(bytes.len() < 8192);
        }
        let request = String::from_utf8(bytes).unwrap();
        assert!(request.starts_with(
            "GET /events?artistName=Example%20Artist&perPage=100&page=3&sort=eventDate HTTP/1.1\r\n"
        ));
        assert!(!request.lines().next().unwrap().contains("jbd_"));
        assert!(
            request
                .to_lowercase()
                .contains("authorization: bearer jbd_abcdefghijklmnop\r\n")
        );
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}")
            .unwrap();
    });
    let agent = ureq::Agent::config_builder()
        .proxy(None)
        .timeout_global(Some(Duration::from_secs(3)))
        .build()
        .new_agent();
    let mut directory = Directory { agent, last: None };
    assert_eq!(
        directory
            .request(
                "jbd_abcdefghijklmnop",
                &format!("http://{address}/events"),
                "Example Artist",
                2
            )
            .unwrap(),
        json!({})
    );
    peer.join().unwrap();
}

#[test]
fn primary_ticket_links_are_preserved_verbatim_with_safe_event_fallback() {
    let mut row = event("Example Artist", "one");
    let ticket = "https://tickets.example/show?partner=example&event=42";
    row["offers"] = json!([{"category":"ticketingLinkPrimary","url":ticket}]);
    let result = projection::project(&page(json!([row.clone()])), "Example Artist", 0).unwrap();
    assert_eq!(result["items"][0]["url"], ticket);
    row["offers"][0]["url"] = json!("javascript:alert(1)");
    let result = projection::project(&page(json!([row])), "Example Artist", 0).unwrap();
    assert_eq!(
        result["items"][0]["url"],
        "https://www.jambase.com/show/example"
    );
}

#[test]
fn production_transport_refuses_redirects_without_forwarding_the_bearer() {
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let peer = thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        let mut bytes = Vec::new();
        while !bytes.ends_with(b"\r\n\r\n") {
            let mut byte = [0];
            socket.read_exact(&mut byte).unwrap();
            bytes.push(byte[0]);
            assert!(bytes.len() < 8192);
        }
        write!(socket,"HTTP/1.1 302 Found\r\nLocation: http://{address}/must-not-receive-a-key\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
        drop(socket);
        listener.set_nonblocking(true).unwrap();
        let deadline = Instant::now() + Duration::from_millis(250);
        loop {
            match listener.accept() {
                Ok((mut socket, _)) => {
                    socket.write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
                    return true;
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    if Instant::now() >= deadline {
                        return false;
                    }
                    thread::sleep(Duration::from_millis(5));
                }
                Err(e) => panic!("fixture accept failed: {e}"),
            }
        }
    });
    let mut directory = Directory::default();
    // Only replace DNS admission in this loopback fixture; reuse the real production HTTP policy.
    directory.agent = ureq::Agent::with_parts(
        directory.agent.config().clone(),
        DefaultConnector::default(),
        ureq::unversioned::resolver::DefaultResolver::default(),
    );
    let secret = "jbd_fictionalredirectkey";
    let error = directory
        .request(secret, &format!("http://{address}/quota"), "", 0)
        .unwrap_err();
    assert!(!error.contains(secret));
    assert!(!error.contains("must-not-receive-a-key"));
    assert!(
        !peer.join().unwrap(),
        "the redirect destination must receive no HTTP request"
    );
}

#[test]
fn provider_errors_do_not_expose_response_bodies_or_the_key() {
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };
    for status in [401, 403, 429, 500] {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let secret = "jbd_fictionalreflectedkey";
        let peer = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            let mut bytes = Vec::new();
            while !bytes.ends_with(b"\r\n\r\n") {
                let mut byte = [0];
                socket.read_exact(&mut byte).unwrap();
                bytes.push(byte[0]);
                assert!(bytes.len() < 8192);
            }
            let body = format!("{{\"error\":\"rejected {secret}\"}}");
            write!(socket,"HTTP/1.1 {status} Refused\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
        });
        let mut directory = Directory::default();
        directory.agent = ureq::Agent::with_parts(
            directory.agent.config().clone(),
            DefaultConnector::default(),
            ureq::unversioned::resolver::DefaultResolver::default(),
        );
        let error = directory
            .request(secret, &format!("http://{address}/quota"), "", 0)
            .unwrap_err();
        assert!(!error.contains(secret));
        assert!(!error.contains("rejected"));
        assert!(!error.contains(&address.to_string()));
        peer.join().unwrap();
    }
}

#[test]
fn oversized_success_bodies_are_bounded_and_do_not_echo_provider_text() {
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let peer = thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        let mut request = Vec::new();
        while !request.ends_with(b"\r\n\r\n") {
            let mut b = [0];
            socket.read_exact(&mut b).unwrap();
            request.push(b[0]);
            assert!(request.len() < 8192);
        }
        let _ = write!(
            socket,
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            2 * 1024 * 1024 + 1
        );
        let _ = socket.write_all(&vec![b'x'; 2 * 1024 * 1024 + 1]);
    });
    let mut directory = Directory::default();
    directory.agent = ureq::Agent::with_parts(
        directory.agent.config().clone(),
        DefaultConnector::default(),
        ureq::unversioned::resolver::DefaultResolver::default(),
    );
    let error = directory
        .request(
            "jbd_fictionalboundedkey",
            &format!("http://{address}/quota"),
            "",
            0,
        )
        .unwrap_err();
    assert_eq!(error, "Réponse JamBase trop grande ou interrompue.");
    peer.join().unwrap();
}
