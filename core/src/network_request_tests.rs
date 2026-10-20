use super::*;
use std::sync::atomic::Ordering;

#[test]
fn busy_retries_retire_for_json_artwork_spectra_and_policy_admission() {
    for status in [409, 429, 503] {
        for operation in [
            "json",
            "artwork",
            "spectrum",
            "parental",
            "download",
            "output",
            "retained",
            "image-policy",
        ] {
            let fixture = super::test_support::busy(status);
            let current = || {
                if fixture.current.load(Ordering::SeqCst) {
                    Ok(())
                } else {
                    Err("fixture request retired".to_owned())
                }
            };
            let result = match operation {
                "json" => fixture
                    .client
                    .request_admitted(
                        "GET",
                        "/api/me/v1/annotation",
                        &[("ref", "track:fixture")],
                        None,
                        current,
                    )
                    .map(|_| ()),
                "artwork" => fixture
                    .client
                    .artwork_admitted("release:fixture", "cover", current)
                    .map(|_| ()),
                "spectrum" => fixture
                    .client
                    .spectrum_download_admitted("track:fixture", current)
                    .map(|_| ()),
                "parental" => fixture.client.parental_status_admitted(current).map(|_| ()),
                "download" => fixture
                    .client
                    .require_unrestricted_download_admitted(current),
                "output" => fixture.client.require_unrestricted_output_admitted(current),
                "retained" => fixture.client.admit_snapshot_admitted(&json!({}), current),
                "image-policy" => fixture
                    .client
                    .admit_artwork_snapshot_admitted(&json!({}), current),
                _ => unreachable!(),
            };
            fixture.stop.send(()).unwrap();
            let paths = fixture.worker.join().unwrap();
            assert_eq!(
                result.unwrap_err(),
                "fixture request retired",
                "{operation}/{status}"
            );
            assert_eq!(
                paths.len(),
                1,
                "retired {operation}/{status} retried: {paths:?}"
            );
        }
    }
}

#[test]
fn retired_admission_refuses_dispatch_even_for_cached_or_unrestricted_policies() {
    let fixture = super::test_support::busy(503);
    let current = || Err("fixture retired before dispatch".to_owned());
    assert!(
        fixture
            .client
            .request_admitted("GET", "/api/v1/status", &[], None, current)
            .is_err()
    );
    assert!(
        fixture
            .client
            .artwork_admitted("artist:fixture", "logo", current)
            .is_err()
    );
    assert!(
        fixture
            .client
            .spectrum_download_admitted("track:fixture", current)
            .is_err()
    );
    assert!(
        fixture
            .client
            .admit_artwork_snapshot_admitted(&json!({}), current)
            .is_err()
    );
    let mut admin = fixture.client.clone();
    admin.account["role"] = json!("admin");
    assert!(admin.parental_status_admitted(current).is_err());
    assert!(
        admin
            .require_unrestricted_download_admitted(current)
            .is_err()
    );
    assert!(admin.require_unrestricted_output_admitted(current).is_err());
    assert!(admin.admit_snapshot_admitted(&json!({}), current).is_err());
    fixture.stop.send(()).unwrap();
    assert!(fixture.worker.join().unwrap().is_empty());
}
