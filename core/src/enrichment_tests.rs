use super::*;
#[test]
fn app_keys_apply_to_each_job_without_copying_the_local_principal_or_other_secrets() {
    let keys = json!({"fanart":"fictional-key","acoustid":"another-key","password":"never-send"});
    for _ in 0..2 {
        let mut body = json!({"covers":true,"images":true,"targets":["Signal"]});
        attach_service_keys(
            &mut body,
            &keys,
            &json!({"capabilities":["fetch_service_keys"]}),
        )
        .unwrap();
        assert_eq!(
            body["service_keys"],
            json!({"fanarttv":"fictional-key","acoustid":"another-key"})
        );
        assert_eq!(body["targets"], json!(["Signal"]));
        assert!(!body.to_string().contains("never-send"));
    }
}
#[test]
fn unsupported_servers_and_webview_key_injection_fail_before_transmission() {
    let original = json!({"fanart":true});
    let mut body = original.clone();
    assert!(
        attach_service_keys(
            &mut body,
            &json!({"fanart":"secret"}),
            &json!({"capabilities":[]})
        )
        .is_err()
    );
    assert_eq!(body, original);
    assert!(
        attach_service_keys(
            &mut json!({"service_keys": {"fanarttv":"forged"}}),
            &json!({}),
            &json!({})
        )
        .is_err()
    );
    attach_service_keys(&mut body, &json!({}), &json!({})).unwrap();
    assert_eq!(body, original);
    for key in [json!(3), json!(""), json!("unsafe\nkey")] {
        assert!(
            attach_service_keys(
                &mut body,
                &json!({"fanart":key}),
                &json!({"capabilities":["fetch_service_keys"]})
            )
            .is_err()
        );
    }
}
