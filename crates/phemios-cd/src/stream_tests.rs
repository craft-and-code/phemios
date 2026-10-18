use super::*;
#[test]
fn signed_pcm_and_a_subsector_seek_keep_exact_stereo_positions() {
    let chunk = Chunk {
        bytes: vec![0, 0, 255, 127, 0, 128, 0, 64],
        skip: 1,
    };
    assert_eq!(chunk.frames().collect::<Vec<_>>(), vec![[-1., 0.5]]);
    let all = Chunk {
        bytes: chunk.bytes,
        skip: 0,
    };
    assert_eq!(all.frames().next().unwrap(), [0., 32767. / 32768.]);
}

struct Source {
    requests: std::cell::RefCell<Vec<(u32, u32)>>,
    short: bool,
}
impl AudioSectorReader for Source {
    type Error = CdReaderError;
    fn read_audio_sectors(&self, start: u32, count: u32) -> Result<Vec<u8>, Self::Error> {
        self.requests.borrow_mut().push((start, count));
        let mut bytes = vec![0; count as usize * 2352];
        for (index, frame) in bytes.as_chunks_mut::<4>().0.iter_mut().enumerate() {
            let value = (u64::from(start) * 588 + index as u64) as i16;
            frame[..2].copy_from_slice(&value.to_le_bytes());
        }
        if self.short {
            bytes.pop();
        }
        Ok(bytes)
    }
}
#[test]
fn streaming_seeks_to_the_exact_frame_and_never_reads_beyond_track_end() {
    let source = Source {
        requests: Default::default(),
        short: false,
    };
    let track = Track {
        number: 7,
        frames: 60 * 588,
        start: 100,
    };
    let mut stream = TrackReader::new(&source, &track);
    stream.seek(589).unwrap();
    let chunk = stream.next_chunk().unwrap().unwrap();
    assert_eq!(chunk.frames().len(), 27 * 588 - 1);
    assert_eq!(
        chunk.frames().next().unwrap()[0],
        (100i64 * 588 + 589) as i16 as f32 / 32768.
    );
    let mut frames = chunk.frames().len();
    while let Some(chunk) = stream.next_chunk().unwrap() {
        frames += chunk.frames().len();
    }
    assert_eq!(frames, 60 * 588 - 589);
    assert!(
        source
            .requests
            .borrow()
            .iter()
            .all(|(start, count)| *count <= 27 && start + count <= 160)
    );
    stream.seek(track.frames).unwrap();
    assert!(stream.next_chunk().unwrap().is_none());
    assert!(stream.seek(track.frames + 1).is_err());
}
#[test]
fn a_short_sector_read_is_an_error_instead_of_partial_pcm() {
    let source = Source {
        requests: Default::default(),
        short: true,
    };
    let track = Track {
        number: 1,
        frames: 588,
        start: 0,
    };
    assert!(TrackReader::new(&source, &track).next_chunk().is_err());
}
