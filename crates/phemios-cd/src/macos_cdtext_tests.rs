use super::*;
#[test]
fn native_read_toc_layout_matches_the_64_bit_macos_sdk() {
    assert_eq!(size_of::<TocRequest>(), 24);
    assert_eq!(std::mem::offset_of!(TocRequest, length), 14);
    assert_eq!(std::mem::offset_of!(TocRequest, buffer), 16);
    assert!(read("disk9/../../file").is_none());
}
