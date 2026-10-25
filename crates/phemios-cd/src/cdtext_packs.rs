//! Bounded MMC CD-Text packs: complete, CRC-checked single-byte language blocks only.
//! Original parser; format reference: libburn doc/cdtext.txt (MMC Annex J).
use std::collections::BTreeMap;
pub(super) type Rows = Vec<(Option<String>, Option<String>)>;
fn crc(bytes: &[u8]) -> u16 {
    let mut crc = 0u16;
    for byte in bytes {
        crc ^= u16::from(*byte) << 8;
        for _ in 0..8 {
            crc = if crc & 0x8000 != 0 {
                (crc << 1) ^ 0x1021
            } else {
                crc << 1
            };
        }
    }
    !crc
}
pub(super) fn decode(bytes: &[u8]) -> Option<Rows> {
    let bytes = if bytes.len() % 18 == 4 {
        if bytes.len() < 4
            || usize::from(u16::from_be_bytes([bytes[0], bytes[1]])) + 2 != bytes.len()
        {
            return None;
        }
        &bytes[4..]
    } else {
        bytes
    };
    if bytes.is_empty() || bytes.len() > 32760 || !bytes.len().is_multiple_of(18) {
        return None;
    }
    let mut blocks: BTreeMap<u8, Vec<&[u8]>> = BTreeMap::new();
    for pack in bytes.as_chunks::<18>().0 {
        if !(0x80..=0x8f).contains(&pack[0])
            || crc(&pack[..16]) != u16::from_be_bytes([pack[16], pack[17]])
        {
            return None;
        }
        blocks.entry((pack[3] >> 4) & 7).or_default().push(pack);
    }
    for (block, mut packs) in blocks {
        packs.sort_by_key(|pack| pack[2]);
        if let Some(rows) = language(block, &packs) {
            return Some(rows);
        }
    }
    None
}
fn language(block: u8, packs: &[&[u8]]) -> Option<Rows> {
    let mut size = [0u8; 36];
    let parts: Vec<_> = packs.iter().filter(|p| p[0] == 0x8f).collect();
    if parts.len() != 3 {
        return None;
    }
    for (index, pack) in parts.into_iter().enumerate() {
        if usize::from(pack[1]) != index {
            return None;
        }
        size[index * 12..(index + 1) * 12].copy_from_slice(&pack[4..16]);
    }
    // Unsupported encodings/double-byte text remain unidentified, never mojibake.
    if size[0] > 1
        || size[1] == 0
        || size[1] > size[2]
        || size[2] > 99
        || packs.iter().any(|p| p[3] & 0x80 != 0)
        || packs.len() != usize::from(size[20 + usize::from(block)]) + 1
        || packs
            .iter()
            .enumerate()
            .any(|(i, p)| usize::from(p[2]) != i)
    {
        return None;
    }
    for kind in 0x80..=0x8f {
        if packs.iter().filter(|p| p[0] == kind).count()
            != usize::from(size[4 + usize::from(kind - 0x80)])
        {
            return None;
        }
    }
    let mut rows = vec![(None, None); usize::from(size[2]) + 1];
    for kind in [0x80, 0x81] {
        let mut number = 0usize;
        let mut pending = Vec::new();
        for pack in packs.iter().filter(|p| p[0] == kind) {
            if usize::from(pack[1]) != number || usize::from(pack[3] & 15) != pending.len().min(15)
            {
                return None;
            }
            for byte in &pack[4..16] {
                if *byte == 0 {
                    if number < rows.len() {
                        let text: String = if pending == [9] && number > 0 {
                            let previous = &rows[number - 1];
                            if kind == 0x80 {
                                previous.0.clone().unwrap_or_default()
                            } else {
                                previous.1.clone().unwrap_or_default()
                            }
                        } else {
                            if size[0] == 1 && pending.iter().any(|b| *b > 127) {
                                return None;
                            }
                            pending.iter().map(|b| char::from(*b)).collect()
                        };
                        if !text.is_empty() {
                            if kind == 0x80 {
                                rows[number].0 = Some(text);
                            } else {
                                rows[number].1 = Some(text);
                            }
                        }
                    } else if !pending.is_empty() {
                        return None;
                    }
                    pending.clear();
                    number = if number == 0 {
                        usize::from(size[1])
                    } else {
                        number + 1
                    };
                } else {
                    if pending.len() >= 512 {
                        return None;
                    }
                    pending.push(*byte);
                }
            }
        }
        if !pending.is_empty() {
            return None;
        }
    }
    rows.iter()
        .any(|(a, b)| a.is_some() || b.is_some())
        .then_some(rows)
}
#[cfg(test)]
#[path = "cdtext_packs_tests.rs"]
mod tests;
