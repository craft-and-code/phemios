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

#[test]
fn track_lyrics_selectors_route_to_their_actual_library_and_unwrap_engine_references() {
    let local = qualify("track:signal", Source::Local);
    let mut query = std::collections::BTreeMap::from([("track".into(), local.clone())]);
    assert_eq!(
        request_origin(&mut query, &mut None, Source::Server).unwrap(),
        Source::Local
    );
    assert_eq!(query["track"], "track:signal");
    let mut body = Some(json!({"track":local}));
    assert_eq!(
        request_origin(&mut Default::default(), &mut body, Source::Server).unwrap(),
        Source::Local
    );
    assert_eq!(body.unwrap()["track"], "track:signal");
    let mut mixed = std::collections::BTreeMap::from([
        ("track".into(), qualify("track:signal", Source::Local)),
        ("ref".into(), "release:remote".into()),
    ]);
    assert!(request_origin(&mut mixed, &mut None, Source::Server).is_err());
}

#[test]
fn album_label_lists_retain_their_source_without_changing_display_names() {
    let mut value = json!({"reference":"release:fixture", "labels":["label:studio"], "name":"Studio", "tags":["label:personal"]});
    map(&mut value, Source::Local, true).unwrap();
    assert_eq!(value["labels"][0], qualify("label:studio", Source::Local));
    assert_eq!(value["tags"][0], "label:personal");
    map(&mut value, Source::Local, false).unwrap();
    assert_eq!(value["labels"][0], "label:studio");
}

#[test]
fn all_aede_annotation_kinds_retain_their_local_snapshot_origin_and_literal_values() {
    for source in [Source::Local, Source::Server] {
        for kind in [
            "artist",
            "release",
            "track",
            "recording",
            "work",
            "release_group",
            "label",
            "genre",
        ] {
            let reference = format!("{kind}:fixture");
            let mut value = json!({"items":[{"reference":reference,"loved":true,"rating":4,"note":"genre:literal note","tags":["release_group:literal tag"]}]});
            let original = value.clone();
            map(&mut value, source, true).unwrap();
            let qualified = format!("{kind}:@phemios/{}/fixture", source.name());
            assert_eq!(value["items"][0]["reference"], qualified);
            assert_eq!(value["items"][0]["note"], original["items"][0]["note"]);
            assert_eq!(value["items"][0]["tags"], original["items"][0]["tags"]);
            assert_eq!(resolve(&qualified).unwrap(), (source, reference));
            map(&mut value, source, false).unwrap();
            assert_eq!(value, original);
        }
    }
}

#[test]
fn genre_and_release_group_annotation_requests_preserve_owner_and_refuse_mixed_origins() {
    for kind in ["genre", "release_group"] {
        let reference = format!("{kind}:@phemios/local/fixture");
        let mut query = std::collections::BTreeMap::from([("ref".into(), reference.clone())]);
        assert_eq!(
            request_origin(&mut query, &mut None, Source::Server).unwrap(),
            Source::Local
        );
        assert_eq!(query["ref"], format!("{kind}:fixture"));
        let mut mixed = json!({"items":[reference,format!("{kind}:@phemios/server/fixture")]});
        assert!(map(&mut mixed, Source::Local, false).is_err());
    }
}

#[test]
fn namespace_markers_inside_engine_keys_remain_literal_in_legacy_and_qualified_selectors() {
    let legacy = "track:/music/artist:@phemios/local/unrelated/fixture.flac";
    assert_eq!(resolve(legacy).unwrap(), (Source::Server, legacy.into()));
    let mut query = std::collections::BTreeMap::from([("ref".into(), legacy.into())]);
    assert_eq!(
        request_origin(&mut query, &mut None, Source::Local).unwrap(),
        Source::Server
    );
    assert_eq!(query["ref"], legacy);
    for source in [Source::Local, Source::Server] {
        let qualified = qualify(legacy, source);
        assert_eq!(resolve(&qualified).unwrap(), (source, legacy.into()));
        let mut value = json!({"reference":qualified});
        map(&mut value, source, false).unwrap();
        assert_eq!(value["reference"], legacy);
    }
}
