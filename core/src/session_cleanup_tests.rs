use super::*;
#[test]
fn failed_audio_cleanup_does_not_skip_credential_revocation() {
    let revoked = std::cell::Cell::new(false);
    let result = complete(
        || Err("audio failed".into()),
        || {
            revoked.set(true);
            Ok(())
        },
    );
    assert!(revoked.get(), "the remote session was never revoked");
    assert_eq!(result, Err("audio failed".into()));
}

#[test]
fn both_cleanup_failures_remain_visible_and_success_is_not_invented() {
    assert_eq!(
        complete(|| Err("audio".into()), || Err("revoke".into())),
        Err("audio\nrevoke".into())
    );
    assert_eq!(
        complete(|| Ok(()), || Err("revoke".into())),
        Err("revoke".into())
    );
    assert_eq!(complete(|| Ok(()), || Ok(())), Ok(()));
}

#[test]
fn native_and_external_output_failures_do_not_skip_final_source_release() {
    let calls = std::cell::RefCell::new(Vec::new());
    let result = complete(
        || {
            complete(
                || {
                    calls.borrow_mut().push("native");
                    Err("native output".into())
                },
                || {
                    calls.borrow_mut().push("external");
                    Err("external output".into())
                },
            )
        },
        || {
            calls.borrow_mut().push("source");
            Ok(())
        },
    );
    assert_eq!(*calls.borrow(), ["native", "external", "source"]);
    assert_eq!(result, Err("native output\nexternal output".into()));
}
