use super::*;
#[test]
fn pcm_accepts_only_complete_finite_mono_or_stereo_frames() {
    let bytes: Vec<_> = [0.25_f32, -0.5]
        .into_iter()
        .flat_map(f32::to_le_bytes)
        .collect();
    assert_eq!(pcm(&bytes, 2).unwrap(), vec![[0.25, -0.5]]);
    assert_eq!(pcm(&bytes[..4], 1).unwrap(), vec![[0.25, 0.25]]);
    assert!(pcm(&bytes[..7], 2).is_err());
    assert!(pcm(&f32::NAN.to_le_bytes(), 1).is_err());
    assert!(pcm(&bytes, 3).is_err());
}
#[test]
fn start_is_catalog_scoped_and_preserves_the_server_control_budget() {
    assert!(
        start(
            "/music/private.flac",
            48000,
            super::super::Policy::WithoutEffects
        )
        .is_err()
    );
    assert!(
        start(
            &format!("track:{}", "a".repeat(4096)),
            48000,
            super::super::Policy::WithoutEffects
        )
        .is_err()
    );
    let value: Value = serde_json::from_str(
        &start("track:sample", 48000, super::super::Policy::WithoutEffects).unwrap(),
    )
    .unwrap();
    assert_eq!(value["interactive"], true);
    assert_eq!(value["normalize"], "off");
    assert_eq!(value["sample_rate"], 48000);
}
#[test]
fn format_preserves_source_offset_but_refuses_wrong_track_rate_or_channels() {
    let value = json!({"type":"format","track":"track:one","encoding":"f32le","sample_rate":48000,"channels":2,"epoch":1,"position_ms":1234,"duration_ms":null});
    let parsed = format(&value, "track:one", 48000).unwrap();
    assert_eq!(parsed.position, 1234);
    assert_eq!(parsed.duration, None);
    assert!(format(&value, "track:other", 48000).is_err());
    assert!(format(&value, "track:one", 44100).is_err());
    for invalid in [json!(3), json!(0), json!(null)] {
        let mut broken = value.clone();
        broken["channels"] = invalid;
        assert!(format(&broken, "track:one", 48000).is_err());
    }
}

#[test]
fn dsp_settings_are_explicit_and_strict_policy_is_refused() {
    let v: Value =
        serde_json::from_str(&start("track:sample", 48000, super::super::Policy::Dsp).unwrap())
            .unwrap();
    assert_eq!(v["normalize"], "album");
    assert!(super::super::Policy::parse("bit-perfect").is_err());
}
