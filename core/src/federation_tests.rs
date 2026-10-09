use super::*;
use serde_json::json;
#[test]
fn colliding_engine_references_stay_distinct_and_roundtrip() {
    let a = qualify("release:signal", Source::Local);
    let b = qualify("release:signal", Source::Server);
    assert_ne!(a, b);
    assert_eq!(
        resolve(&a).unwrap(),
        (Source::Local, "release:signal".into())
    );
    assert!(resolve("release:@phemios/other/signal").is_err());
}
#[test]
fn notes_paths_and_tags_are_never_rewritten() {
    let mut value = json!({"reference":"artist:signal","note":"artist:signal","tags":["artist:signal"],"path":"artist:signal","albums":[{"reference":"release:signal"}]});
    let original = value.clone();
    map(&mut value, Source::Local, true).unwrap();
    assert_eq!(value["note"], original["note"]);
    assert_eq!(value["tags"], original["tags"]);
    assert_eq!(value["path"], original["path"]);
    map(&mut value, Source::Local, false).unwrap();
    assert_eq!(value, original);
}
#[test]
fn cross_library_mutation_is_refused() {
    let mut value =
        json!({"tracks":[qualify("track:a",Source::Local),qualify("track:b",Source::Server)]});
    assert!(map(&mut value, Source::Local, false).is_err());
}

#[test]
fn collection_album_members_keep_their_origin() {
    let mut value = json!({"items":["release:first","release:second"]});
    map(&mut value, Source::Local, true).unwrap();
    assert_eq!(value["items"][0], qualify("release:first", Source::Local));
}
