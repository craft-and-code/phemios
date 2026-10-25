//! Admit only the declared, completely transferred MMC format-5 response before decoding names.
pub(super) const CAPACITY: usize = 32768;
pub(super) fn finish(bytes: &[u8], transferred: usize) -> Option<super::cdtext_packs::Rows> {
    if !(4..=bytes.len().min(CAPACITY)).contains(&transferred) {
        return None;
    }
    let length = usize::from(u16::from_be_bytes([bytes[0], bytes[1]])) + 2;
    if length <= 4 || length > transferred || !(length - 4).is_multiple_of(18) {
        return None;
    }
    super::cdtext_packs::decode(&bytes[..length])
}
#[cfg(test)]
#[path = "cdtext_io_tests.rs"]
mod tests;
