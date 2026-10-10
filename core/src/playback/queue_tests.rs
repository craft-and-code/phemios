use super::*;
#[test]
fn shuffle_keeps_current_and_played_occurrences_and_restores_only_future_order() {
    let mut queue = Queue::new(20, 3);
    queue.shuffle(true).unwrap();
    assert_eq!(queue.index(), 3);
    assert_eq!(&queue.order()[..4], &[0, 1, 2, 3]);
    let mut all = queue.order().to_vec();
    all.sort_unstable();
    assert_eq!(all, (0..20).collect::<Vec<_>>());
    assert!(queue.next());
    let visited = queue.index();
    queue.shuffle(false).unwrap();
    assert_eq!(queue.index(), visited);
    assert_eq!(queue.order()[4], visited);
    assert!(
        queue.order()[5..]
            .windows(2)
            .all(|values| values[0] < values[1])
    );
    queue.previous();
    assert_eq!(queue.index(), 3);
    assert!(queue.jump(19));
    assert_eq!(queue.index(), 19);
    assert!(!queue.jump(99));
}
