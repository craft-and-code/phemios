//! Original synthetic Latin-1 CD-Text data; no source audio or commercial disc bytes.
pub(super) fn pack(kind: u8, track: u8, sequence: u8, payload: &[u8]) -> [u8; 18] {
    let mut pack = [0u8; 18];
    pack[..4].copy_from_slice(&[kind, track, sequence, 0]);
    pack[4..4 + payload.len()].copy_from_slice(payload);
    let mut crc = 0u16;
    for byte in &pack[..16] {
        crc ^= u16::from(*byte) << 8;
        for _ in 0..8 {
            crc = if crc & 0x8000 != 0 {
                (crc << 1) ^ 0x1021
            } else {
                crc << 1
            };
        }
    }
    pack[16..].copy_from_slice(&(!crc).to_be_bytes());
    pack
}

pub(super) fn response() -> Vec<u8> {
    let mut size = [0u8; 36];
    size[1] = 1;
    size[2] = 1;
    size[4] = 1;
    size[5] = 1;
    size[19] = 3;
    size[20] = 4;
    size[28] = 0x0f;
    let mut response = vec![0, 92, 0, 0];
    response.extend(pack(0x80, 0, 0, b"Caf\xe9\0Song\0"));
    response.extend(pack(0x81, 0, 1, b"Band\0Band\0"));
    for index in 0..3 {
        response.extend(pack(
            0x8f,
            index,
            index + 2,
            &size[usize::from(index) * 12..usize::from(index + 1) * 12],
        ));
    }
    response
}
