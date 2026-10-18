use super::*;
#[test]
fn untrusted_remote_components_cannot_escape_a_destination_or_select_windows_streams() {
    for part in [
        "NUL.mp3",
        "CON.long.suffix",
        "COM1.flac",
        "dot.",
        "space ",
        "wild*.mp3",
        "",
        ".",
        "..",
        "/root",
        "a/b",
        "a\\b",
        "C:",
        "file:audio",
        "a\0b",
        "line\nbreak",
    ] {
        assert!(relative(&[part.into()]).is_err(), "{part:?}");
    }
    assert!(relative(&[]).is_err());
    assert!(relative(&["a".repeat(256)]).is_err());
    assert_eq!(
        relative(&["Artist".into(), "Album".into(), "01 Track.flac".into()]).unwrap(),
        PathBuf::from("Artist").join("Album").join("01 Track.flac")
    );
}
