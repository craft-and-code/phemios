use super::*;
use serde_json::json;
#[test]
fn preview_uses_authoritative_output_names_without_changing_source_staging_paths() {
    let original = vec!["Artist".into(), "01.flac".into()];
    let row = json!({"key":["artist","01 flac"],"output_components":["Artist","01.mp3"],"output_key":["artist","01 mp3"]});
    assert_eq!(
        output(&row, &original, true).unwrap().0,
        PathBuf::from("Artist").join("01.mp3")
    );
    assert_eq!(
        output(&row, &original, false).unwrap().0,
        PathBuf::from("Artist").join("01.flac")
    );
    assert_eq!(original[1], "01.flac");
    let lossy = json!({"output_components":["Artist","01.m4a"],"output_key":["artist","01 m4a"]});
    assert!(
        output(&lossy, &["Artist".into(), "01.m4a".into()], true)
            .unwrap()
            .0
            .ends_with("01.m4a")
    );
    for bad in [
        json!({}),
        json!({"output_components":["Artist","../01.mp3"],"output_key":["artist","01"]}),
        json!({"output_components":["Other","01.mp3"],"output_key":["other","01"]}),
        json!({"output_components":["Artist","01.mp3"],"output_key":[]}),
    ] {
        assert!(output(&bad, &original, true).is_err());
    }
    assert!(output(&json!({"key":[]}), &[], false).is_err());
}
#[test]
fn converted_collisions_are_refused_in_either_order_across_batches() {
    for (first, second) in [
        (vec!["artist", "01 mp3"], vec!["artist", "01 mp3"]),
        (vec!["artist", "01 mp3"], vec!["artist", "01 mp3", "02"]),
        (vec!["artist", "01 mp3", "02"], vec!["artist", "01 mp3"]),
    ] {
        let mut paths = BTreeSet::new();
        admit(&mut paths, first.into_iter().map(str::to_owned).collect()).unwrap();
        let held = paths.clone();
        assert!(admit(&mut paths, second.into_iter().map(str::to_owned).collect()).is_err());
        assert_eq!(paths, held);
    }
    let mut paths = BTreeSet::new();
    for key in [
        vec!["local", "artist", "01"],
        vec!["server", "artist", "01"],
    ] {
        admit(&mut paths, key.into_iter().map(str::to_owned).collect()).unwrap();
    }
}
