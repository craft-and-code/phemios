use super::*;
use crate::Library;
use std::{
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};
static NEXT: AtomicU64 = AtomicU64::new(0);
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let dir = std::env::temp_dir().join(format!(
            "phemios-cue-test-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir(&dir).unwrap();
        Self(dir)
    }
    fn binary(&self, name: &str, sectors: usize) {
        let mut bytes = Vec::with_capacity(sectors * 2352);
        for frame in 0..sectors * 588 {
            bytes.extend_from_slice(&(frame as i16).to_le_bytes());
            bytes.extend_from_slice(&((frame as i16).wrapping_neg()).to_le_bytes());
        }
        std::fs::write(self.0.join(name), bytes).unwrap();
    }
    fn cue(&self, text: &str) -> PathBuf {
        let path = self.0.join("test.cue");
        std::fs::write(&path, text).unwrap();
        path
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
#[test]
fn a_selected_image_streams_exact_sectors_and_seeks_without_a_drive_or_server() {
    let f = Fixture::new();
    f.binary("disc.bin", 225);
    let path=f.cue("TITLE \"Example\"\nPERFORMER \"Artist\"\nFILE disc.bin BINARY\nTRACK 01 AUDIO\nTITLE \"First\"\nINDEX 01 00:00:00\nTRACK 02 AUDIO\nTITLE \"Second\"\nINDEX 00 00:01:00\nINDEX 01 00:02:00");
    let mut library = Library::default();
    let id = library.open_image(&path).unwrap();
    let drive = &library.snapshot()[0];
    assert!(drive.image);
    assert_eq!(drive.id, id);
    let disc = drive.disc.clone().unwrap();
    assert_eq!(disc.title(), Some("Example"));
    assert_eq!(disc.track_names(2), (Some("Second"), Some("Artist")));
    assert_eq!(
        disc.tracks
            .iter()
            .map(Track::duration_ms)
            .collect::<Vec<_>>(),
        [2000, 1000]
    );
    disc.with_stream(
        2,
        || true,
        |reader| {
            reader.seek(589)?;
            let chunk = reader.next_chunk()?.unwrap();
            assert_eq!(chunk.frames().len(), 27 * 588 - 1);
            assert_eq!(
                chunk.frames().next().unwrap()[0],
                (150 * 588 + 589) as i16 as f32 / 32768.
            );
            let mut count = chunk.frames().len();
            while let Some(chunk) = reader.next_chunk()? {
                assert!(chunk.frames().len() <= 27 * 588);
                count += chunk.frames().len();
            }
            assert_eq!(count, 75 * 588 - 589);
            Ok(())
        },
    )
    .unwrap();
    library.eject(&id).unwrap();
    assert!(library.snapshot().is_empty());
    assert!(library.disc(&disc.token).is_err());
}
#[test]
fn separate_binary_files_keep_their_own_sector_origin_and_opening_is_transactional() {
    let f = Fixture::new();
    f.binary("one.bin", 75);
    f.binary("two.bin", 150);
    let path=f.cue("FILE one.bin BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:00\nFILE two.bin BINARY\nTRACK 02 AUDIO\nINDEX 01 00:00:00");
    let mut library = Library::default();
    library.open_image(&path).unwrap();
    let disc = library.snapshot()[0].disc.clone().unwrap();
    disc.with_stream(
        2,
        || true,
        |reader| {
            assert_eq!(
                reader.next_chunk()?.unwrap().frames().next().unwrap()[0],
                0.
            );
            Ok(())
        },
    )
    .unwrap();
    f.cue("FILE absent.bin BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:00");
    assert!(library.open_image(&path).is_err());
    assert!(library.disc(&disc.token).is_ok());
    assert!(
        library
            .refresh_image(&library.snapshot()[0].id.clone())
            .is_err()
    );
    assert!(library.disc(&disc.token).is_ok());
}
#[test]
fn cue_paths_sizes_and_indexes_are_admitted_before_source_publication() {
    let f = Fixture::new();
    f.binary("good.bin", 150);
    for file in [
        "../outside.bin",
        "/tmp/outside.bin",
        "C:\\outside.bin",
        "\\\\host\\outside.bin",
        "secret.txt",
    ] {
        let path = f.cue(&format!(
            "FILE \"{file}\" BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:00"
        ));
        assert!(Image::open(&path, "0000000000000001".into()).is_err());
    }
    for layout in [
        "INDEX 01 00:02:00",
        "INDEX 01 00:01:00\nTRACK 02 AUDIO\nINDEX 01 00:00:00",
        "INDEX 01 00:00:00\nTRACK 02 AUDIO\nINDEX 00 00:00:00\nINDEX 01 00:01:00",
    ] {
        let path = f.cue(&format!("FILE good.bin BINARY\nTRACK 01 AUDIO\n{layout}"));
        // Last case is a stored pregap, valid within the same file.
        let accepted = layout.contains("INDEX 00");
        assert_eq!(
            Image::open(&path, "0000000000000001".into()).is_ok(),
            accepted
        );
    }
    std::fs::write(f.0.join("bad.bin"), [0; 7]).unwrap();
    assert!(
        Image::open(
            &f.cue("FILE bad.bin BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:00"),
            "x".into()
        )
        .is_err()
    );
}
#[test]
fn changed_binary_bytes_cannot_silently_become_a_retained_disc() {
    let f = Fixture::new();
    f.binary("disc.bin", 75);
    let path = f.cue("FILE disc.bin BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:00");
    let disc = Image::open(&path, "0000000000000001".into()).unwrap();
    std::fs::write(f.0.join("disc.bin"), [0; 2352]).unwrap();
    assert!(
        disc.with_stream(1, || true, |reader| reader.next_chunk().map(|_| ()))
            .is_err()
    );
}
#[cfg(unix)]
#[test]
fn a_cue_cannot_use_a_symlink_to_leave_the_selected_directory() {
    let f = Fixture::new();
    let outside = Fixture::new();
    outside.binary("secret.bin", 75);
    std::os::unix::fs::symlink(outside.0.join("secret.bin"), f.0.join("linked.bin")).unwrap();
    assert!(
        Image::open(
            &f.cue("FILE linked.bin BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:00"),
            "x".into()
        )
        .is_err()
    );
}

#[test]
fn refreshing_or_reopening_an_unchanged_image_retains_the_prepared_queue_references() {
    let f = Fixture::new();
    f.binary("disc.bin", 75);
    let path = f.cue("FILE disc.bin BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:00");
    let mut library = Library::default();
    let id = library.open_image(&path).unwrap();
    let token = library.snapshot()[0].disc.as_ref().unwrap().token.clone();
    library.refresh_image(&id).unwrap();
    assert!(library.disc(&token).is_ok());
    assert_eq!(library.open_image(&path).unwrap(), id);
    assert!(library.disc(&token).is_ok());
}
