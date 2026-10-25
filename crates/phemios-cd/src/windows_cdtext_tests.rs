use super::*;
use crate::cdtext_io::CAPACITY;
#[test]
fn native_read_toc_ex_query_decodes_titles_and_performers_from_the_actual_response() {
    let rows = query_with(|query, bytes| {
        assert_eq!(IOCTL_READ_TOC_EX, 147540);
        assert_eq!(*query, [5, 0, 0, 0]);
        assert_eq!(bytes.len(), CAPACITY);
        let fixture = crate::cdtext_fixtures::response();
        bytes[..fixture.len()].copy_from_slice(&fixture);
        Some(fixture.len())
    })
    .expect("valid Windows CD-Text response");
    assert_eq!(rows[0], (Some("Café".into()), Some("Band".into())));
    assert_eq!(rows[1], (Some("Song".into()), Some("Band".into())));
}
#[test]
fn failed_short_oversized_or_corrupt_windows_responses_stay_unidentified() {
    for count in [
        None,
        Some(0),
        Some(3),
        Some(CAPACITY + 1),
        Some(usize::MAX),
        Some(93),
    ] {
        assert!(
            query_with(|_, bytes| {
                let fixture = crate::cdtext_fixtures::response();
                bytes[..fixture.len()].copy_from_slice(&fixture);
                count
            })
            .is_none()
        );
    }
    assert!(
        query_with(|_, bytes| {
            let fixture = crate::cdtext_fixtures::response();
            bytes[..fixture.len()].copy_from_slice(&fixture);
            bytes[10] ^= 1;
            Some(fixture.len())
        })
        .is_none()
    );
}
#[test]
fn paths_match_native_discovered_optical_letters_and_never_arbitrary_files_or_unc_shares() {
    for path in [r"\\.\D:", r"\\.\Z:"] {
        assert!(valid_path(path));
    }
    for path in [
        "",
        "D:",
        r"\\.\d:",
        r"\\.\D:\file",
        r"\\server\share",
        r"C:\music.flac",
        r"\\.\PhysicalDrive0",
    ] {
        assert!(!valid_path(path));
    }
}
