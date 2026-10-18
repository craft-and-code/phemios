use super::*;
use crate::Library;
use std::{
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};
static NEXT: AtomicU64 = AtomicU64::new(0);
struct Fixture(PathBuf);
impl Fixture {
    fn new(extension: &str) -> Self {
        let dir = std::env::temp_dir().join(format!(
            "phemios-image-format-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir(&dir).unwrap();
        std::fs::copy(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join(format!("tests/fixtures/ramp.{extension}")),
            dir.join(format!("disc.{extension}")),
        )
        .unwrap();
        std::fs::write(dir.join("disc.cue"), format!("FILE disc.{extension} WAVE\nTRACK 01 AUDIO\nINDEX 01 00:00:00\nTRACK 02 AUDIO\nINDEX 01 00:01:00")).unwrap();
        Self(dir)
    }
    fn disc(&self) -> Disc {
        Image::open(&self.0.join("disc.cue"), "0000000000000001".into()).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn exact_source(extension: &str) {
    let fixture = Fixture::new(extension);
    let disc = fixture.disc();
    assert_eq!(
        disc.tracks
            .iter()
            .map(Track::duration_ms)
            .collect::<Vec<_>>(),
        [1000, 2000]
    );
    disc.with_stream(
        2,
        || true,
        |reader| {
            for seek in [589, 70000, 0, 88200] {
                reader.seek(seek)?;
                let mut position = 75 * 588 + seek;
                let mut frames = 0;
                while let Some(chunk) = reader.next_chunk()? {
                    assert!(chunk.frames().len() <= 27 * 588);
                    for frame in chunk.frames() {
                        let expected = (position % 30001) as i16 - 15000;
                        assert_eq!(
                            frame,
                            [f32::from(expected) / 32768., -f32::from(expected) / 32768.],
                            "{extension} frame {position}"
                        );
                        position += 1;
                        frames += 1;
                    }
                }
                assert_eq!(frames, 150 * 588 - seek);
            }
            Ok(())
        },
    )
    .unwrap();
}
#[test]
fn real_flac_and_wave_images_preserve_every_sample_across_track_bounds_and_seeks() {
    for extension in ["flac", "wav"] {
        exact_source(extension);
    }
}
#[test]
fn compressed_images_are_revalidated_and_invalid_replacements_preserve_the_selection() {
    let fixture = Fixture::new("flac");
    let mut library = Library::default();
    library.open_image(&fixture.0.join("disc.cue")).unwrap();
    let disc = fixture.disc();
    std::fs::write(fixture.0.join("disc.flac"), [0; 64]).unwrap();
    assert!(
        disc.with_stream(1, || true, |r| r.next_chunk().map(|_| ()))
            .is_err()
    );
    assert!(library.open_image(&fixture.0.join("disc.cue")).is_err());
    assert_eq!(library.snapshot().len(), 1);
}
#[test]
fn non_cd_quality_wave_is_refused_without_resampling_or_truncating() {
    for (offset, bytes) in [
        (24, 48000u32.to_le_bytes().to_vec()),
        (22, 1u16.to_le_bytes().to_vec()),
        (34, 24u16.to_le_bytes().to_vec()),
    ] {
        let fixture = Fixture::new("wav");
        let path = fixture.0.join("disc.wav");
        let mut file = std::fs::read(&path).unwrap();
        file[offset..offset + bytes.len()].copy_from_slice(&bytes);
        std::fs::write(path, file).unwrap();
        assert!(Image::open(&fixture.0.join("disc.cue"), "x".into()).is_err());
    }
}
#[test]
fn ape_images_use_real_ffmpeg_and_accurate_seeks_when_available() {
    if std::process::Command::new("ffmpeg")
        .arg("-version")
        .output()
        .is_err()
        || std::process::Command::new("ffprobe")
            .arg("-version")
            .output()
            .is_err()
    {
        assert!(
            std::env::var_os("PHEMIOS_REQUIRE_FFMPEG").is_none(),
            "APE acceptance requires installed FFmpeg and FFprobe"
        );
        eprintln!("APE acceptance not run: FFmpeg/FFprobe unavailable");
        return;
    }
    exact_source("ape");
}

#[test]
fn mixed_wave_and_flac_files_retain_independent_origins_and_image_refresh_identity() {
    let fixture = Fixture::new("flac");
    std::fs::copy(
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/ramp.wav"),
        fixture.0.join("second.wav"),
    )
    .unwrap();
    std::fs::write(fixture.0.join("disc.cue"), "FILE disc.flac WAVE\nTRACK 01 AUDIO\nINDEX 01 00:00:00\nFILE second.wav WAVE\nTRACK 02 AUDIO\nINDEX 01 00:00:00").unwrap();
    let mut library = Library::default();
    let id = library.open_image(&fixture.0.join("disc.cue")).unwrap();
    let token = library.snapshot()[0].disc.as_ref().unwrap().token.clone();
    library.refresh_image(&id).unwrap();
    let disc = library.disc(&token).unwrap();
    for track in [1, 2] {
        disc.with_stream(
            track,
            || true,
            |r| {
                let first = r.next_chunk()?.unwrap().frames().next().unwrap();
                assert_eq!(first, [-15000. / 32768., 15000. / 32768.]);
                Ok(())
            },
        )
        .unwrap();
    }
}
#[test]
fn mismatched_cue_storage_and_corrupt_container_headers_are_refused() {
    let fixture = Fixture::new("flac");
    for text in [
        "FILE disc.flac BINARY",
        "FILE disc.flac APE",
        "FILE disc.flac MOTOROLA",
    ] {
        let cue = format!("{text}\nTRACK 01 AUDIO\nINDEX 01 00:00:00");
        std::fs::write(fixture.0.join("disc.cue"), cue).unwrap();
        assert!(Image::open(&fixture.0.join("disc.cue"), "x".into()).is_err());
    }
    std::fs::write(fixture.0.join("disc.flac"), [0; 100]).unwrap();
    std::fs::write(
        fixture.0.join("disc.cue"),
        "FILE disc.flac WAVE\nTRACK 01 AUDIO\nINDEX 01 00:00:00",
    )
    .unwrap();
    assert!(Image::open(&fixture.0.join("disc.cue"), "x".into()).is_err());
}
