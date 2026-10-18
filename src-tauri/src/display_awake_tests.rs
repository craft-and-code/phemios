use super::*;
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
struct Guard(Arc<AtomicUsize>);
impl Drop for Guard {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}
#[test]
fn one_lease_is_renewed_then_released_by_pause_expiry_or_a_new_scope() {
    let count = Arc::new(AtomicUsize::new(0));
    let create = || {
        count.fetch_add(1, Ordering::SeqCst);
        Ok(Guard(count.clone()))
    };
    let now = Instant::now();
    let mut lease = Lease::default();
    let scope = lease.open().unwrap();
    lease.update(scope, true, now, create).unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 1);
    lease
        .update(scope, true, now + Duration::from_secs(5), create)
        .unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 1);
    lease.expire(now + Duration::from_secs(13));
    assert_eq!(count.load(Ordering::SeqCst), 1);
    lease.expire(now + Duration::from_secs(18));
    assert_eq!(count.load(Ordering::SeqCst), 0);
    lease
        .update(scope, true, now + Duration::from_secs(20), create)
        .unwrap();
    lease
        .update(scope, false, now + Duration::from_secs(21), create)
        .unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 0);
    lease
        .update(scope, true, now + Duration::from_secs(22), create)
        .unwrap();
    let next = lease.open().unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 0);
    assert!(lease.update(scope, true, now, create).is_err());
    lease.update(next, true, now, create).unwrap();
    assert!(lease.update(scope, false, now, create).is_err());
    assert_eq!(count.load(Ordering::SeqCst), 1);
    drop(lease);
    assert_eq!(count.load(Ordering::SeqCst), 0);
}
#[test]
fn failed_acquisition_is_not_reported_as_active_and_can_be_retried() {
    let mut lease = Lease::<Guard>::default();
    let scope = lease.open().unwrap();
    assert!(
        lease
            .update(scope, true, Instant::now(), || Err(
                "fixture unavailable".into()
            ))
            .is_err()
    );
    assert!(lease.guard.is_none());
    assert!(lease.expires.is_none());
    lease
        .update(scope, false, Instant::now(), || {
            panic!("release must not acquire")
        })
        .unwrap();
}
