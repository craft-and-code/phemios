use super::*;
/// Original synthetic CD-Text packs: Latin-1, album/track title and performer, one French block.
/// Layout follows MMC and libburn's doc/cdtext.txt; no commercial disc bytes are retained.
use crate::cdtext_fixtures::pack;
#[test]
fn valid_latin1_titles_and_performers_decode_from_original_packs() {
    let mut size = [0u8; 36];
    size[1] = 1;
    size[2] = 1;
    size[4] = 1;
    size[5] = 1;
    size[19] = 3;
    size[20] = 4;
    size[28] = 0x0f;
    let mut bytes = Vec::new();
    bytes.extend(pack(0x80, 0, 0, b"Caf\xe9\0Song\0"));
    bytes.extend(pack(0x81, 0, 1, b"Band\0Band\0"));
    for index in 0..3 {
        bytes.extend(pack(
            0x8f,
            index,
            index + 2,
            &size[usize::from(index) * 12..usize::from(index + 1) * 12],
        ));
    }
    // A valid CRC does not rescue an unsupported charset or a missing pack.
    let mut unsupported = bytes.clone();
    unsupported[36..54].copy_from_slice(&pack(
        0x8f,
        0,
        2,
        &[0x80, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    ));
    assert!(decode(&unsupported).is_none());
    assert!(decode(&bytes[18..]).is_none());
    assert!(decode(&[]).is_none());
    assert!(decode(&[0; 4]).is_none());
    let rows = decode(&bytes).expect("valid synthetic CD-Text");
    let mut corrupt = bytes.clone();
    corrupt[6] ^= 1;
    assert!(decode(&corrupt).is_none());
    assert!(decode(&bytes[..bytes.len() - 1]).is_none());
    assert_eq!(rows[0], (Some("Café".into()), Some("Band".into())));
    assert_eq!(rows[1], (Some("Song".into()), Some("Band".into())));
    let mut header = vec![0, 92, 0, 0];
    header.extend(bytes);
    assert_eq!(decode(&header), Some(rows));
}

#[test]
fn continuation_packs_and_non_one_first_track_keep_physical_numbers() {
    let mut size = [0u8; 36];
    size[1] = 3;
    size[2] = 3;
    size[4] = 2;
    size[19] = 3;
    size[20] = 4;
    let mut bytes = Vec::from(pack(0x80, 0, 0, b"Album\0Track "));
    let mut continuation = pack(0x80, 3, 1, b"three\0");
    continuation[3] = 6;
    let checksum = crc(&continuation[..16]);
    continuation[16..].copy_from_slice(&checksum.to_be_bytes());
    bytes.extend(continuation);
    for index in 0..3 {
        bytes.extend(pack(
            0x8f,
            index,
            index + 2,
            &size[usize::from(index) * 12..usize::from(index + 1) * 12],
        ));
    }
    let rows = decode(&bytes).unwrap();
    assert_eq!(rows[0].0.as_deref(), Some("Album"));
    assert_eq!(rows[1].0, None);
    assert_eq!(rows[3].0.as_deref(), Some("Track three"));
}
