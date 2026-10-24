//! PH-010: the actual native CD permission must re-admit retained named accounts.
use super::{permission, source};
use serde_json::json;
use std::sync::{
    Arc,
    atomic::{AtomicU64, Ordering},
};
#[path = "../../core/src/network_media_admission_test_support.rs"]
mod support;
use phemios_core::network::Client;
use support::{Reply, account, policy};

#[test]
fn ph010_named_cd_refuses_a_cached_admin_after_server_bearer_revocation() {
    for status in [401, 403] {
        let server = support::serve(
            account("admin", Some(false)),
            Reply::refused(status),
            Reply::refused(status),
        );
        let client = Client::login(&server.url, "fixture-listener", "fictional-password").unwrap();
        let owner = source(Some(client));
        let check = permission(&[&owner]).unwrap();
        let result = check();
        let paths = server.finish();
        assert!(
            result.is_err(),
            "PH-010: stale named administrator CD permission survived HTTP {status}"
        );
        assert!(paths.iter().any(|path| path == "/api/auth/v1/session"));
    }
}

#[test]
fn ph010_cd_rechecks_current_administrator_on_every_permission_call() {
    let server = support::serve(
        account("admin", Some(false)),
        Reply::ok(account("admin", Some(false))),
        Reply::ok(policy(false)),
    );
    let client = Client::login(&server.url, "fixture-listener", "fictional-password").unwrap();
    let owner = source(Some(client));
    let check = permission(&[&owner]).unwrap();
    check().unwrap();
    check().unwrap();
    let paths = server.finish();
    assert_eq!(
        paths
            .iter()
            .filter(|path| path.as_str() == "/api/auth/v1/session")
            .count(),
        3,
        "login plus two fresh named-administrator checks"
    );
}

#[test]
fn ph010_cd_refuses_live_role_identity_disabled_or_malformed_admin_replacement() {
    let mut other = account("admin", Some(false));
    other["id"] = json!("other-owner");
    let mut disabled = account("admin", Some(false));
    disabled["enabled"] = json!(false);
    for live in [
        other,
        disabled,
        account("user", Some(true)),
        account("auditor", Some(false)),
        json!({}),
    ] {
        let server = support::serve(
            account("admin", Some(false)),
            Reply::ok(live.clone()),
            Reply::ok(policy(false)),
        );
        let client = Client::login(&server.url, "fixture-listener", "fictional-password").unwrap();
        let owner = source(Some(client));
        let result = permission(&[&owner]).unwrap()();
        server.finish();
        assert!(
            result.is_err(),
            "PH-010: changed live account admitted CD: {live}"
        );
    }
}

#[test]
fn ph010_cd_normal_supervised_and_unrestricted_users_remain_distinct() {
    for enabled in [false, true] {
        let server = support::serve(
            account("user", Some(false)),
            Reply::ok(account("user", Some(enabled))),
            Reply::ok(policy(enabled)),
        );
        let client = Client::login(&server.url, "fixture-listener", "fictional-password").unwrap();
        let owner = source(Some(client));
        let result = permission(&[&owner]).unwrap()();
        let paths = server.finish();
        assert_eq!(result.is_ok(), !enabled, "CD supervised={enabled}");
        assert!(paths.iter().any(|path| path == "/api/me/v1/parental"));
    }
}

#[test]
fn ph010_cd_cached_admin_busy_live_read_retires_with_native_generation() {
    for status in [409, 429, 503] {
        let generation = Arc::new(AtomicU64::new(0));
        let retired = generation.clone();
        let server = support::serve_retiring(
            account("admin", Some(false)),
            Reply::ok(account("admin", Some(false))),
            Reply::ok(policy(false)),
            Some((
                status,
                Box::new(move || {
                    retired.fetch_add(1, Ordering::SeqCst);
                }),
            )),
        );
        let client = Client::login(&server.url, "fixture-listener", "fictional-password").unwrap();
        let mut owner = source(Some(client));
        owner.generation = generation;
        let result = permission(&[&owner]).unwrap()();
        let paths = server.finish();
        assert!(
            result.is_err(),
            "PH-010: retired admin CD check admitted after {status}"
        );
        assert_eq!(
            paths.len(),
            2,
            "retired first live read cannot dispatch a busy retry"
        );
    }
}

#[test]
fn ph010_explicit_anonymous_cd_needs_no_named_account_server() {
    let local = source(None);
    let remote = source(None);
    let check = permission(&[&local, &remote]).unwrap();
    check().unwrap();
    check().unwrap();
}
