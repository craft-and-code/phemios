use super::*;
#[test]
fn audio_indexes_and_quoted_metadata_retain_physical_positions() {
    let sheet=parse("\u{feff}TITLE \"Sample Disc\"\nPERFORMER \"Example\"\nFILE \"audio file.bin\" BINARY\n TRACK 01 AUDIO\n TITLE \"One\"\n INDEX 01 00:00:00\n TRACK 02 AUDIO\n INDEX 00 00:01:00\n INDEX 01 00:02:00\n INDEX 02 00:03:00\nREM arbitrary \" comment\n").unwrap();
    assert_eq!(sheet.title.as_deref(), Some("Sample Disc"));
    assert_eq!(sheet.performer.as_deref(), Some("Example"));
    assert_eq!(sheet.tracks[0].title.as_deref(), Some("One"));
    assert_eq!(sheet.tracks[1].index, Some(150));
    assert_eq!(sheet.tracks[1].indexes.get(&0), Some(&75));
    assert_eq!(sheet.files, ["audio file.bin"]);
}
#[test]
fn invalid_or_unsupported_layouts_never_silently_change_timing_or_decode_data() {
    for text in [
        "",
        "FILE x.bin BINARY",
        "TRACK 01 AUDIO\nINDEX 01 00:00:00",
        "FILE x.bin WAVE\nTRACK 01 AUDIO\nINDEX 01 00:00:00",
        "FILE x.bin BINARY\nTRACK 01 MODE1/2352\nINDEX 01 00:00:00",
        "FILE x.bin BINARY\nTRACK 00 AUDIO\nINDEX 01 00:00:00",
        "FILE x.bin BINARY\nTRACK 01 AUDIO\nINDEX 01 00:60:00",
        "FILE x.bin BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:75",
        "FILE x.bin BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:00\nINDEX 01 00:01:00",
        "FILE x.bin BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:00\nFLAGS PRE",
        "FILE x.bin BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:00\nPOSTGAP 00:02:00",
        "FILE x.bin BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:00\nFILE y.bin BINARY",
        "FILE \"x.bin BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:00",
    ] {
        assert!(parse(text).is_err(), "accepted {text}");
    }
    assert!(parse("FILE x.bin BINARY\nTRACK 01 AUDIO\nPREGAP 00:02:00\nINDEX 01 00:00:00").is_ok());
}
