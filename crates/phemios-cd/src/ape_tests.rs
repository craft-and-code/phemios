use super::*;
#[test]
fn ape_probe_refuses_unknown_precision_duplicate_streams_and_non_sector_lengths() {
    let good = "sample_rate=44100\nchannels=2\nbits_per_sample=0\nbits_per_raw_sample=16\nduration_ts=132300\ntime_base=1/44100\n";
    assert_eq!(parse(good).unwrap(), 132300);
    for bad in [
        good.replace("44100\nchannels", "48000\nchannels"),
        good.replace("raw_sample=16", "raw_sample=24"),
        good.replace("132300", "132301"),
        format!("{good}channels=2\n"),
    ] {
        assert!(parse(&bad).is_err());
    }
}

#[test]
fn helper_discovery_never_uses_relative_path_or_current_directory_entries() {
    let root = std::env::temp_dir().join(format!("phemios-cd-helper-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let name = if cfg!(windows) {
        "ffprobe.exe"
    } else {
        "ffprobe"
    };
    std::fs::write(root.join(name), []).unwrap();
    assert!(locate("ffprobe", &["".into(), ".".into(), "bin".into()]).is_none());
    assert_eq!(
        locate("ffprobe", std::slice::from_ref(&root)),
        Some(root.join(name))
    );
    std::fs::remove_dir_all(root).unwrap();
}
