use super::*;
#[test]
fn extracts_source_labels_in_section_order_without_following_or_executing_html() {
    let html = r#"<p><a class="external" href="https://outside.example">Outside</a></p>
      <div class="mw-heading"><h3><span id="Liens_externes">Liens externes</span></h3></div>
      <ul><li>Ressources relatives à la musique : <ul>
        <li><a class="external text" href="https://music.example/artist?a=1&amp;b=2">Music <b>Catalogue</b></a></li>
        <li><a class="external" href="//archive.example/id">Archive</a></li>
        <li><a class="external" href="https://archive.example/other">Archive</a></li>
        <li><a class="external" href="https://archive.example/id">Archive</a></li>
        <li><a href="/wiki/Example">Internal</a></li>
      </ul></li></ul>
      <h4>More resources</h4><a class="external" href="https://more.example/#ref">More</a>
      <div class="navbox"><a class="external" href="https://navigation.example">Navigation</a></div>
      <h3>Next section</h3><a class="external" href="https://after.example">After</a>"#;
    assert_eq!(
        extract(html).unwrap(),
        json!([
            {"label":"Music Catalogue","url":"https://music.example/artist?a=1&b=2"},
            {"label":"Archive","url":"https://archive.example/id"},
            {"label":"Archive","url":"https://archive.example/other"},
            {"label":"More","url":"https://more.example/#ref"}
        ])
    );
}
#[test]
fn refuses_active_local_credentialled_or_malformed_links_and_accepts_english_headings() {
    let mut html = String::from("<h2 id='External_links'>External links</h2>");
    for url in [
        "javascript:alert(1)",
        "file:///private/secret",
        "data:text/html,test",
        "https://user:password@music.example/",
        "http://localhost/",
        "http://localhost./",
        "http://127.1/",
        "https://music.local/",
        "https://music.example:444/",
        "https://music.example/#\n",
        "https://music.example/\\evil",
    ] {
        html.push_str(&format!("<a class='external' href='{url}'>Untrusted</a>"));
    }
    html.push_str("<a class='external' href='http://public.example/'>Public</a>");
    assert_eq!(
        extract(&html).unwrap(),
        json!([{"label":"Public","url":"http://public.example/"}])
    );
    assert_eq!(
        extract("<a class='external' href='https://music.example'>No section</a>").unwrap(),
        json!([])
    );
}
#[test]
fn validates_saved_metadata_bounds_and_keeps_duplicate_labels_with_distinct_addresses() {
    assert!(validate(&json!([{"label":"Music","url":"https://music.example/#id"}])).is_ok());
    assert!(validate(&json!([{"label":"Music","url":"javascript:alert(1)"}])).is_err());
    let entry = json!({"label":"Music","url":"https://music.example/"});
    assert!(validate(&json!([entry.clone(), entry])).is_err());
    assert!(validate(&json!([{"label":"x".repeat(513),"url":"https://music.example/"}])).is_err());
    assert!(extract(&"x".repeat(4 * 1024 * 1024 + 1)).is_err());
    let html = format!(
        "<h2 id='External_links'>External links</h2>{}",
        (0..257)
            .map(|i| format!(
                "<a class='external' href='https://music.example/{i}'>Provider {i}</a>"
            ))
            .collect::<String>()
    );
    assert!(extract(&html).is_err());
}

#[test]
fn rendered_resources_must_belong_to_the_requested_page_and_revision() {
    let raw = json!({"parse":{"pageid":42,"revid":91,"text":"<h2 id='External_links'>External links</h2><a class='external' href='https://music.example/'>Music</a>"}});
    assert_eq!(response_links(&raw, 42, 91).unwrap()[0]["label"], "Music");
    assert!(response_links(&raw, 43, 91).is_err());
    assert!(response_links(&raw, 42, 92).is_err());
    assert!(response_links(&json!({"error":{"code":"badrevid"}}), 42, 91).is_err());
}

#[test]
fn refuses_browser_normalized_local_hosts_and_ports_the_browser_handoff_would_reject() {
    let addresses = [
        "https://%31%32%37.0.0.1/",
        "https://0x7f.1/",
        "https://[::ffff:8.8.8.8]/",
        "http://music.example:443/",
        "https://music.example:80/",
    ];
    let admitted = addresses
        .into_iter()
        .filter(|url| safe_url(url))
        .collect::<Vec<_>>();
    assert!(
        admitted.is_empty(),
        "native resource validation admitted: {admitted:?}"
    );
}

#[test]
fn agrees_with_frontend_resource_address_admission_for_the_shared_matrix() {
    let cases: Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/wikipedia-resource-addresses.json"
    ))
    .unwrap();
    for case in cases.as_array().unwrap() {
        let url = case["url"].as_str().unwrap();
        assert_eq!(safe_url(url), case["valid"].as_bool().unwrap(), "{url}");
        if safe_url(url) {
            assert!(crate::external_links::browser_url(url).is_ok(), "{url}");
        }
    }
}

#[test]
fn excluded_navigation_headings_cannot_open_or_close_the_resource_section() {
    let html = r#"<h2>Biography</h2>
      <div class='navbox'><h2 id='External_links'>External links</h2></div>
      <a class='external' href='https://unrelated.example/'>Unrelated</a>
      <h2>External links</h2>
      <a class='external' href='https://first.example/'>First</a>
      <a class='external metadata' href='https://hidden.example/'>Hidden</a>
      <h2 class='metadata'>Inline metadata heading</h2>
      <div class='metadata'><h2>Metadata heading</h2></div>
      <a class='external' href='https://last.example/'>Last</a>
      <h2>Next section</h2>
      <a class='external' href='https://after.example/'>After</a>"#;
    assert_eq!(
        extract(html).unwrap(),
        json!([
            {"label":"First","url":"https://first.example/"},
            {"label":"Last","url":"https://last.example/"}
        ])
    );
}
