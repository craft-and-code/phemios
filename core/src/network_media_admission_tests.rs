//! PH-010: retained named accounts require current server authority for external media.
use super::super::Client;
use serde_json::json;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
#[path = "network_media_admission_test_support.rs"]
mod support;
use support::{Reply, account, policy};

fn guard(
    client: &Client,
    operation: &str,
    current: impl Fn() -> Result<(), String>,
) -> Result<(), String> {
    match operation {
        "download" => client.require_unrestricted_download_admitted(current),
        "output" => client.require_unrestricted_output_admitted(current),
        _ => unreachable!(),
    }
}

#[test]
fn ph010_cached_administrator_cannot_export_or_prepare_output_after_live_refusal() {
    for operation in ["download", "output"] {
        for status in [401, 403] {
            let server = support::serve(
                account("admin", Some(false)),
                Reply::refused(status),
                Reply::refused(status),
            );
            let client =
                Client::login(&server.url, "fixture-listener", "fictional-password").unwrap();
            let result = guard(&client, operation, || Ok(()));
            let paths = server.finish();
            assert!(
                result.is_err(),
                "PH-010: cached admin admitted {operation} after live HTTP {status}"
            );
            assert!(
                paths.iter().any(|path| path == "/api/auth/v1/session"),
                "named admin exemption needs live authority"
            );
        }
    }
}

#[test]
fn ph010_current_administrator_and_legacy_user_require_a_confirmed_live_session() {
    for (role, marker) in [("admin", Some(false)), ("user", None)] {
        for operation in ["download", "output"] {
            let server = support::serve(
                account(role, marker),
                Reply::ok(account(role, marker)),
                Reply::ok(policy(false)),
            );
            let client =
                Client::login(&server.url, "fixture-listener", "fictional-password").unwrap();
            let result = guard(&client, operation, || Ok(()));
            let paths = server.finish();
            assert!(result.is_ok(), "current {role} {operation}: {result:?}");
            assert!(
                paths.iter().any(|path| path == "/api/auth/v1/session"),
                "cached {role} metadata cannot be its own admission"
            );
        }
    }
}

#[test]
fn ph010_cached_exemptions_refuse_changed_identity_role_disabled_and_malformed_live_accounts() {
    let mut different = account("admin", Some(false));
    different["id"] = json!("replacement-owner");
    let mut disabled = account("admin", Some(false));
    disabled["enabled"] = json!(false);
    for live in [
        different,
        account("user", Some(true)),
        disabled,
        json!({}),
        json!({"id":"media-owner","role":"admin","enabled":"true"}),
    ] {
        for operation in ["download", "output"] {
            let server = support::serve(
                account("admin", Some(false)),
                Reply::ok(live.clone()),
                Reply::ok(policy(false)),
            );
            let client =
                Client::login(&server.url, "fixture-listener", "fictional-password").unwrap();
            let result = guard(&client, operation, || Ok(()));
            server.finish();
            assert!(
                result.is_err(),
                "PH-010: invalid live identity/role admitted {operation}: {live}"
            );
        }
    }
}

#[test]
fn ph010_legacy_marker_cannot_ignore_new_live_supervision_or_refused_session() {
    for operation in ["download", "output"] {
        for live in [Reply::refused(401), Reply::ok(account("user", Some(true)))] {
            let server = support::serve(account("user", None), live, Reply::ok(policy(true)));
            let client =
                Client::login(&server.url, "fixture-listener", "fictional-password").unwrap();
            let result = guard(&client, operation, || Ok(()));
            server.finish();
            assert!(
                result.is_err(),
                "PH-010: old missing marker admitted {operation} after server restriction"
            );
        }
    }
}

#[test]
fn ph010_normal_user_download_and_output_keep_live_supervision_enforced() {
    for operation in ["download", "output"] {
        for enabled in [false, true] {
            let server = support::serve(
                account("user", Some(false)),
                Reply::ok(account("user", Some(enabled))),
                Reply::ok(policy(enabled)),
            );
            let client =
                Client::login(&server.url, "fixture-listener", "fictional-password").unwrap();
            let result = guard(&client, operation, || Ok(()));
            let paths = server.finish();
            assert_eq!(result.is_ok(), !enabled, "{operation}/supervised={enabled}");
            assert!(paths.iter().any(|path| path == "/api/me/v1/parental"));
        }
    }
}

#[test]
fn ph010_busy_live_admission_cannot_retry_after_cancellation() {
    for operation in ["download", "output"] {
        for status in [409, 429, 503] {
            let current = Arc::new(AtomicBool::new(true));
            let retired = current.clone();
            let server = support::serve_retiring(
                account("admin", Some(false)),
                Reply::ok(account("admin", Some(false))),
                Reply::ok(policy(false)),
                Some((
                    status,
                    Box::new(move || {
                        retired.store(false, Ordering::SeqCst);
                    }),
                )),
            );
            let client =
                Client::login(&server.url, "fixture-listener", "fictional-password").unwrap();
            let result = guard(&client, operation, || {
                if current.load(Ordering::SeqCst) {
                    Ok(())
                } else {
                    Err("fixture admission retired".into())
                }
            });
            let paths = server.finish();
            assert!(
                result.is_err(),
                "PH-010: cancelled {operation}/{status} admitted"
            );
            assert_eq!(
                paths.len(),
                2,
                "only login and the retired first read may dispatch"
            );
        }
    }
}
