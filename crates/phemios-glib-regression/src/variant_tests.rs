use glib::{Variant, variant::ToVariant};

fn strings(values: &[&str]) -> Variant {
    values.to_variant()
}

#[test]
fn empty_array_is_exhausted_from_both_ends() {
    let value = strings(&[]);
    let mut iter = value.array_iter_str().unwrap();
    assert_eq!(iter.len(), 0);
    assert_eq!(iter.next(), None);
    assert_eq!(iter.next_back(), None);
    assert_eq!(iter.nth(1), None);
    assert_eq!(iter.nth_back(1), None);
    assert_eq!(iter.last(), None);
}

#[test]
fn forward_iteration_borrows_empty_ascii_and_unicode_strings() {
    let expected = ["", "Aede", "Phémios", "音楽 🎵"];
    let value = strings(&expected);
    let actual: Vec<_> = value.array_iter_str().unwrap().collect();
    assert_eq!(actual, expected);
    // Borrowed results remain valid after the iterator is gone while its Variant lives.
    assert_eq!(actual[2], "Phémios");
}

#[test]
fn reverse_iteration_preserves_borrowed_unicode() {
    let value = strings(&["first", "Écho", ""]);
    let actual: Vec<_> = value.array_iter_str().unwrap().rev().collect();
    assert_eq!(actual, ["", "Écho", "first"]);
}

#[test]
fn mixed_iteration_consumes_each_end_without_duplicates() {
    let value = strings(&["a", "b", "c", "d"]);
    let mut iter = value.array_iter_str().unwrap();
    assert_eq!(iter.next(), Some("a"));
    assert_eq!(iter.next_back(), Some("d"));
    assert_eq!(iter.len(), 2);
    assert_eq!(iter.next_back(), Some("c"));
    assert_eq!(iter.next(), Some("b"));
    assert_eq!(iter.len(), 0);
    assert_eq!(iter.next_back(), None);
    assert_eq!(iter.next(), None);
}

#[test]
fn nth_and_nth_back_share_the_remaining_range() {
    let value = strings(&["0", "1", "2", "3", "4", "5"]);
    let mut iter = value.array_iter_str().unwrap();
    assert_eq!(iter.nth(1), Some("1"));
    assert_eq!(iter.len(), 4);
    assert_eq!(iter.nth_back(1), Some("4"));
    assert_eq!(iter.len(), 2);
    assert_eq!(iter.last(), Some("3"));
}

#[test]
fn last_respects_previous_back_consumption() {
    let value = strings(&["a", "b", "c"]);
    let mut iter = value.array_iter_str().unwrap();
    assert_eq!(iter.next_back(), Some("c"));
    assert_eq!(iter.last(), Some("b"));
}

#[test]
fn oversized_nth_exhausts_without_accessing_outside_the_variant() {
    let value = strings(&["only"]);
    let mut iter = value.array_iter_str().unwrap();
    assert_eq!(iter.nth(usize::MAX), None);
    assert_eq!(iter.len(), 0);
    assert_eq!(iter.next_back(), None);
    let mut iter = value.array_iter_str().unwrap();
    assert_eq!(iter.nth_back(usize::MAX), None);
    assert_eq!(iter.len(), 0);
    assert_eq!(iter.next(), None);
}

#[test]
fn non_string_array_is_rejected_by_the_public_api() {
    assert!(42_i32.to_variant().array_iter_str().is_err());
    assert!([1_i32, 2].to_variant().array_iter_str().is_err());
}
