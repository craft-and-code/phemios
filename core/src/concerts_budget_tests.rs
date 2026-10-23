use super::super::{Value, guarded_events};
use super::*;
use std::sync::atomic::{AtomicU64, Ordering};
struct Sandbox(PathBuf);
impl Sandbox {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        Self(std::env::temp_dir().join(format!(
            "phemios-jambase-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        )))
    }
}
impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
#[test]
fn attempted_calls_survive_restart_and_1001st_attempt_never_reaches_http() {
    let root = Sandbox::new();
    let mut budget = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
    budget.attempts = vec![1_800_000_000; 999];
    budget.reserve().unwrap();
    drop(budget);
    let mut restored = Budget::at(root.0.clone(), 1_800_000_001).unwrap();
    assert_eq!(restored.status()["remaining"], 0);
    assert!(
        guarded_events(
            "jbd_abcdefghijklmnop",
            "Artist",
            0,
            &mut restored,
            |_, _, _| panic!("quota exhaustion must not send HTTP")
        )
        .is_err()
    );
    assert_eq!(restored.status()["used"], 1000);
}
#[test]
fn failed_http_is_charged_before_dispatch_and_invalid_quota_sends_no_event() {
    let root = Sandbox::new();
    let mut budget = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
    let mut calls = Vec::new();
    assert!(guarded_events("jbd_abcdefghijklmnop","Artist",0,&mut budget,|endpoint,_,_|{
  calls.push(endpoint.to_owned());
  if endpoint.ends_with("/quota") {Ok(json!({"usedCalls":0,"remainingCalls":1000,"quota":1000,"overageCalls":0,"noMonthlyCap":false,"periodStart":"2026-10-01T00:00:00.000Z","periodEnd":"2026-11-01T00:00:00.000Z"}))}
  else {let persisted:Value=serde_json::from_slice(&fs::read(root.0.join("jambase-budget.json")).unwrap()).unwrap();assert_eq!(persisted["attempts"].as_array().unwrap().len(),1);Err("timeout".into())}
 }).is_err());
    assert_eq!(calls.len(), 2);
    assert_eq!(budget.status()["used"], 1);
    let mut calls = 0;
    assert!(
        guarded_events(
            "jbd_abcdefghijklmnop",
            "Artist",
            0,
            &mut budget,
            |_, _, _| {
                calls += 1;
                Ok(json!({}))
            }
        )
        .is_err()
    );
    assert_eq!(calls, 1);
    assert_eq!(budget.status()["used"], 1);
}
#[test]
fn parallel_instances_clock_rollback_and_corrupt_stores_do_not_bypass_admission() {
    let root = Sandbox::new();
    let mut budget = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
    assert!(Budget::at(root.0.clone(), 1_800_000_000).is_err());
    budget.reserve().unwrap();
    drop(budget);
    assert!(Budget::at(root.0.clone(), 1_799_999_999).is_err());
    let path = root.0.join("jambase-budget.json");
    fs::write(&path, b"broken").unwrap();
    assert!(Budget::at(root.0.clone(), 1_800_000_001).is_err());
    assert_eq!(fs::read(path).unwrap(), b"broken");
}
#[test]
fn slots_expire_only_after_32_days_and_pending_publication_fails_closed() {
    let root = Sandbox::new();
    let mut budget = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
    budget.reserve().unwrap();
    drop(budget);
    let before = Budget::at(root.0.clone(), 1_800_000_000 + WINDOW - 1).unwrap();
    assert_eq!(before.status()["used"], 1);
    drop(before);
    let mut after = Budget::at(root.0.clone(), 1_800_000_000 + WINDOW).unwrap();
    assert_eq!(after.status()["used"], 0);
    fs::write(
        root.0.join("jambase-budget.pending"),
        b"interrupted publication",
    )
    .unwrap();
    assert!(after.reserve().is_err());
    assert_eq!(after.status()["used"], 0);
}
#[cfg(unix)]
#[test]
fn symlinked_or_public_budget_files_are_refused_without_following_targets() {
    use std::os::unix::{fs::PermissionsExt, fs::symlink};
    let root = Sandbox::new();
    let initial = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
    drop(initial);
    let target = root.0.join("untouched");
    fs::write(&target, b"private").unwrap();
    let path = root.0.join("jambase-budget.json");
    symlink(&target, &path).unwrap();
    assert!(Budget::at(root.0.clone(), 1_800_000_000).is_err());
    assert_eq!(fs::read(&target).unwrap(), b"private");
    fs::remove_file(&path).unwrap();
    fs::write(&path, b"{}").unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
    assert!(Budget::at(root.0.clone(), 1_800_000_000).is_err());
}

#[test]
fn removing_or_replacing_a_key_does_not_reset_the_shared_local_budget() {
    let root = Sandbox::new();
    let engine = crate::local::Engine::new(root.0.clone(), PathBuf::from("missing-engine"));
    engine
        .configure_concerts(Some("jbd_abcdefghijklmnop"), false)
        .unwrap();
    let mut budget = engine.concert_budget().unwrap();
    budget.reserve().unwrap();
    drop(budget);
    engine.configure_concerts(None, true).unwrap();
    assert!(engine.concert_key().unwrap().is_none());
    engine
        .configure_concerts(Some("jbd_replacementkeyexample"), false)
        .unwrap();
    assert_eq!(engine.concert_budget().unwrap().status()["used"], 1);
}

#[test]
fn stale_shared_usage_cannot_send_a_1001st_call_after_restart() {
    let root = Sandbox::new();
    let mut budget = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
    let quota = json!({"usedCalls":999,"remainingCalls":1,"quota":1000,"overageCalls":0,"noMonthlyCap":false,"periodStart":"2026-10-01T00:00:00.000Z","periodEnd":"2026-11-01T00:00:00.000Z"});
    let mut event_calls = 0;
    assert!(
        guarded_events(
            "jbd_abcdefghijklmnop",
            "Artist",
            0,
            &mut budget,
            |endpoint, _, _| {
                if endpoint.ends_with("/quota") {
                    Ok(quota.clone())
                } else {
                    event_calls += 1;
                    Err("ambiguous timeout".into())
                }
            }
        )
        .is_err()
    );
    assert_eq!(event_calls, 1);
    assert_eq!(budget.status()["used"], 1000);
    drop(budget);
    let mut restored = Budget::at(root.0.clone(), 1_800_000_001).unwrap();
    assert!(
        guarded_events(
            "jbd_replacementkeyexample",
            "Artist",
            0,
            &mut restored,
            |_, _, _| panic!("stale provider counters must not permit another request")
        )
        .is_err()
    );
}
#[test]
fn rising_provider_usage_does_not_double_charge_confirmed_local_attempts() {
    let root = Sandbox::new();
    let mut budget = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
    let mut quota = json!({"usedCalls":100,"remainingCalls":900,"quota":1000,"periodStart":"2026-10-01T00:00:00.000Z","periodEnd":"2026-11-01T00:00:00.000Z"});
    budget.reconcile(&quota).unwrap();
    budget.reserve().unwrap();
    assert_eq!(budget.status()["used"], 101);
    quota["usedCalls"] = json!(101);
    quota["remainingCalls"] = json!(899);
    budget.reconcile(&quota).unwrap();
    budget.reserve().unwrap();
    assert_eq!(budget.status()["used"], 102);
    quota["usedCalls"] = json!(105);
    quota["remainingCalls"] = json!(895);
    budget.reconcile(&quota).unwrap();
    budget.reserve().unwrap();
    assert_eq!(budget.status()["used"], 106);
    quota["periodStart"] = json!("2026-11-01T00:00:00.000Z");
    quota["periodEnd"] = json!("2026-12-01T00:00:00.000Z");
    quota["usedCalls"] = json!(0);
    quota["remainingCalls"] = json!(1000);
    budget.reconcile(&quota).unwrap();
    budget.reserve().unwrap();
    assert_eq!(budget.status()["used"], 107);
}

#[test]
fn stale_usage_cannot_reuse_the_final_slot_of_a_lower_provider_quota() {
    let root = Sandbox::new();
    let quota = json!({"usedCalls":499,"remainingCalls":1,"quota":500,"overageCalls":0,"noMonthlyCap":false,"periodStart":"2026-10-01T00:00:00.000Z","periodEnd":"2026-11-01T00:00:00.000Z"});
    let mut event_calls = 0;
    for _ in 0..2 {
        let mut budget = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
        let _ = guarded_events(
            "jbd_abcdefghijklmnop",
            "Artist",
            0,
            &mut budget,
            |endpoint, _, _| {
                if endpoint.ends_with("/quota") {
                    Ok(quota.clone())
                } else {
                    event_calls += 1;
                    Err("ambiguous timeout".into())
                }
            },
        );
    }
    assert_eq!(
        event_calls, 1,
        "the provider's last free slot may be reserved only once"
    );
}

#[test]
fn a_partial_remaining_allowance_limits_reservations_despite_lagging_usage() {
    let root = Sandbox::new();
    let quota = json!({"usedCalls":499,"remainingCalls":1,"quota":1000,"overageCalls":0,"noMonthlyCap":false,"periodStart":"2026-10-01T00:00:00.000Z","periodEnd":"2026-11-01T00:00:00.000Z"});
    let mut event_calls = 0;
    for _ in 0..2 {
        let mut budget = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
        let _ = guarded_events(
            "jbd_abcdefghijklmnop",
            "Artist",
            0,
            &mut budget,
            |endpoint, _, _| {
                if endpoint.ends_with("/quota") {
                    Ok(quota.clone())
                } else {
                    event_calls += 1;
                    Err("ambiguous timeout".into())
                }
            },
        );
    }
    assert_eq!(event_calls, 1);
}

#[test]
fn legacy_high_water_ledgers_survive_and_invalid_retained_ceilings_fail_closed() {
    let root = Sandbox::new();
    let mut initial = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
    initial.reserve().unwrap();
    drop(initial);
    let path = root.0.join("jambase-budget.json");
    let mut raw = json!({"version":1,"attempts":[1_800_000_000],"remote":{"usedCalls":1,"periodStart":"2026-10-01T00:00:00.000Z","periodEnd":"2026-11-01T00:00:00.000Z"}});
    fs::write(&path, raw.to_string()).unwrap();
    let restored = Budget::at(root.0.clone(), 1_800_000_001).unwrap();
    assert_eq!(restored.status()["used"], 1);
    drop(restored);
    for ceiling in [json!(1001), json!(-1), json!("1000"), Value::Null] {
        raw["remote"]["ceiling"] = ceiling;
        let bytes = raw.to_string();
        fs::write(&path, &bytes).unwrap();
        assert!(Budget::at(root.0.clone(), 1_800_000_001).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), bytes);
    }
}

#[test]
fn dropping_a_budget_releases_its_lock_even_with_a_duplicated_handle() {
    let root = Sandbox::new();
    let mut budget = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
    budget.reserve().unwrap();
    let duplicate = budget._lease.0.try_clone().unwrap();
    // Failed admission must not release the active owner's lock.
    assert!(Budget::at(root.0.clone(), 1_800_000_001).is_err());
    assert!(Budget::at(root.0.clone(), 1_800_000_001).is_err());
    drop(budget);

    let successor = Budget::at(root.0.clone(), 1_800_000_001).unwrap();
    assert_eq!(successor.status()["used"], 1);
    // Closing a retired owner's duplicate cannot unlock a newly acquired lease.
    drop(duplicate);
    assert!(Budget::at(root.0.clone(), 1_800_000_001).is_err());
    drop(successor);
    assert_eq!(
        Budget::at(root.0.clone(), 1_800_000_002).unwrap().status()["used"],
        1
    );
}

#[test]
fn unwinding_a_budget_releases_its_lock_with_a_duplicated_handle() {
    let root = Sandbox::new();
    let budget = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
    let duplicate = budget._lease.0.try_clone().unwrap();
    let outcome = std::panic::catch_unwind(move || {
        let _owned = budget;
        panic!("fictional request fails while owning the budget");
    });
    assert!(outcome.is_err());
    let successor = Budget::at(root.0.clone(), 1_800_000_001).unwrap();
    assert_eq!(successor.status()["used"], 0);
    drop(duplicate);
    assert!(Budget::at(root.0.clone(), 1_800_000_001).is_err());
}

#[test]
fn rejected_journals_release_the_lease_before_a_budget_can_be_constructed() {
    for broken in [
        "not JSON",
        r#"{"version":2,"attempts":[]}"#,
        r#"{"version":1,"attempts":[1800000001,1800000000]}"#,
        r#"{"version":1,"attempts":[1800000002]}"#,
        r#"{"version":1,"attempts":[],"remote":{"periodStart":"invalid"}}"#,
    ] {
        let root = Sandbox::new();
        let mut initial = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
        initial.reserve().unwrap();
        let path = root.0.join("jambase-budget.json");
        let retained = fs::read(&path).unwrap();
        let duplicate = initial._lease.0.try_clone().unwrap();
        let lease = initial._lease;
        fs::write(&path, broken).unwrap();

        assert!(Budget::read_retained(root.0.clone(), 1_800_000_001, lease).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), broken);
        // Repair only the fictional fixture, retaining its original charged attempt.
        fs::write(&path, retained).unwrap();
        let successor = Budget::at(root.0.clone(), 1_800_000_001).unwrap();
        assert_eq!(successor.status()["used"], 1);
        assert!(Budget::at(root.0.clone(), 1_800_000_001).is_err());
        drop(duplicate);
        assert!(Budget::at(root.0.clone(), 1_800_000_001).is_err());
    }
}

#[test]
fn journal_admission_errors_release_the_lease_with_a_duplicated_handle() {
    let root = Sandbox::new();
    let initial = Budget::at(root.0.clone(), 1_800_000_000).unwrap();
    let duplicate = initial._lease.0.try_clone().unwrap();
    let path = root.0.join("jambase-budget.json");
    fs::create_dir(&path).unwrap();
    assert!(Budget::read_retained(root.0.clone(), 1_800_000_001, initial._lease).is_err());
    assert!(path.is_dir(), "refused storage must remain untouched");
    fs::remove_dir(&path).unwrap();
    let successor = Budget::at(root.0.clone(), 1_800_000_001).unwrap();
    drop(duplicate);
    assert!(Budget::at(root.0.clone(), 1_800_000_001).is_err());
    drop(successor);
    assert!(Budget::at(root.0.clone(), 1_800_000_001).is_ok());
}
