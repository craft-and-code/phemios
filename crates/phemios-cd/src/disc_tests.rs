use super::*;
struct NoIo;
impl AudioSectorReader for NoIo {
    type Error = std::io::Error;
    fn read_audio_sectors(&self, _: u32, _: u32) -> Result<Vec<u8>, Self::Error> {
        panic!("TOC inspection must not decode audio");
    }
}
fn toc() -> Toc {
    Toc {
        first_track: 3,
        last_track: 7,
        leadout_lba: 300,
        tracks: vec![
            cd_da_reader::Track {
                number: 3,
                start_lba: 0,
                start_msf: (0, 2, 0),
                is_audio: true,
            },
            cd_da_reader::Track {
                number: 7,
                start_lba: 150,
                start_msf: (0, 4, 0),
                is_audio: true,
            },
        ],
    }
}
fn inspect(t: &Toc) -> Result<Disc, String> {
    Disc::inspect(
        &NoIo,
        t,
        "disk9".into(),
        "0000000000000001".into(),
        Arc::default(),
    )
}
#[test]
fn audio_track_numbers_durations_and_references_come_from_the_disc() {
    let disc = inspect(&toc()).unwrap();
    assert_eq!(
        disc.tracks.iter().map(|t| t.number).collect::<Vec<_>>(),
        [3, 7]
    );
    assert_eq!(disc.tracks[0].duration_ms(), 2000);
    assert!(disc.track("track:cd/0000000000000001/7").is_ok());
    assert!(disc.track("track:cd/0000000000000002/7").is_err());
    assert!(disc.track("track:cd/0000000000000001/1").is_err());
    let mut changed = toc();
    changed.leadout_lba += 1;
    assert!(!disc.matches(&changed));
}
#[test]
fn malformed_and_data_only_discs_are_not_audio_selections() {
    for mode in 0..6 {
        let mut t = toc();
        match mode {
            0 => t.tracks[1].number = 3,
            1 => t.tracks[1].start_lba = 0,
            2 => t.leadout_lba = 150,
            3 => t.tracks.iter_mut().for_each(|t| t.is_audio = false),
            4 => t.first_track = 1,
            _ => t.leadout_lba = u32::MAX,
        };
        assert!(inspect(&t).is_err(), "mode {mode}");
    }
}
#[test]
fn cd_extra_data_session_gap_is_excluded_using_upstream_bounds() {
    let t = Toc {
        first_track: 1,
        last_track: 2,
        leadout_lba: 15000,
        tracks: vec![
            cd_da_reader::Track {
                number: 1,
                start_lba: 0,
                start_msf: (0, 2, 0),
                is_audio: true,
            },
            cd_da_reader::Track {
                number: 2,
                start_lba: 12000,
                start_msf: (2, 42, 0),
                is_audio: false,
            },
        ],
    };
    let disc = inspect(&t).unwrap();
    assert_eq!(disc.tracks.len(), 1);
    assert_eq!(disc.tracks[0].frames, 600 * 588);
}
#[test]
fn unknown_disc_tokens_never_open_caller_supplied_paths() {
    let library = Library::default();
    assert!(library.disc("/dev/disk0").is_err());
}
