use super::*;
#[test]
fn only_explicit_https_urls_enter_the_browser_handoff() {
    for value in [
        "file:///private/music",
        "javascript:alert(1)",
        "https://user:secret@example.org",
        "https://example.org:444/x",
        "https://example.org/\n",
        "https://example.org/evil\\path",
        "https:///missing",
        "--help",
        "http://example.org",
        "https://example.org/ space",
    ] {
        assert!(browser_url(value).is_err(), "{value:?}");
    }
    let url = "https://fr.wikipedia.org/w/index.php?curid=42&action=history#Section";
    assert_eq!(browser_url(url).ok(), Some(url));
    assert!(browser_url(&format!("https://example.org/{}", "a".repeat(4096))).is_err());
}

#[test]
fn helper_receives_the_whole_url_as_one_argument_without_a_shell() {
    let url = "https://example.org/?a=1&b=%22literal%22#part";
    let command = browser_command(browser_url(url).unwrap()).unwrap();
    let args = command.get_args().collect::<Vec<_>>();
    assert_eq!(args.last().and_then(|arg| arg.to_str()), Some(url));
    assert!(open_browser("javascript:alert(1)").is_err());
    #[cfg(target_os = "macos")]
    {
        assert_eq!(command.get_program(), "/usr/bin/open");
        assert_eq!(args.len(), 2);
        assert_eq!(args[0], "--");
    }
}
