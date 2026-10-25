use super::*;
#[test]
fn only_complete_framed_responses_are_decoded_even_when_the_driver_zero_pads() {
    let bytes = crate::cdtext_fixtures::response();
    let rows = finish(&bytes, bytes.len()).unwrap();
    assert_eq!(rows[0].0.as_deref(), Some("Café"));
    let mut padded = bytes.clone();
    padded.resize(CAPACITY, 0);
    assert_eq!(finish(&padded, CAPACITY), Some(rows));
    for count in [0, 1, 2, 3, bytes.len() - 1, CAPACITY + 1, usize::MAX] {
        assert!(finish(&bytes, count).is_none());
    }
    for broken in [vec![], vec![0; 4], vec![0, 1, 0, 0], vec![0xff; 16]] {
        assert!(finish(&broken, broken.len()).is_none());
    }
    let mut corrupt = bytes.clone();
    corrupt[10] ^= 1;
    assert!(finish(&corrupt, corrupt.len()).is_none());
    assert!(finish(&bytes[4..], bytes.len() - 4).is_none());
}
