use super::*;
fn media(path: &str) -> cd_da_reader::DriveInfo {
    cd_da_reader::DriveInfo {
        path: path.into(),
        has_audio_cd: true,
    }
}
fn named(path: &str, name: &str) -> Source {
    Source {
        path: "dr:IOService:/Example/Writer".into(),
        name: name.into(),
        media: Some(path.into()),
    }
}
#[test]
fn readable_media_keeps_its_hardware_name_when_writer_enumeration_omits_it() {
    let rows = merge(Vec::new(), vec![media("disk6")], |path| {
        Some(named(path, "ASUS SDRW-08U7M-U"))
    });
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].name, "ASUS SDRW-08U7M-U");
    assert!(rows[0].path.starts_with("dr:IOService:/"));
    assert_eq!(rows[0].media.as_deref(), Some("disk6"));
}
#[test]
fn an_already_named_writer_is_never_duplicated_or_re_resolved() {
    let rows = merge(vec![named("disk6", "Writer")], vec![media("disk6")], |_| {
        panic!("already identified")
    });
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].name, "Writer");
}
#[test]
fn unknown_hardware_retains_an_explicit_generic_readable_source() {
    let rows = merge(Vec::new(), vec![media("disk6")], |_| None);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].name, "Lecteur CD 1");
    assert_eq!(rows[0].path, "disk6");
    assert_eq!(rows[0].media.as_deref(), Some("disk6"));
}

#[test]
fn a_writer_with_pending_media_status_is_updated_in_place_not_duplicated() {
    let mut empty = named("disk6", "Writer");
    empty.media = None;
    let rows = merge(vec![empty], vec![media("disk6")], |path| {
        Some(named(path, "ASUS Writer"))
    });
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].name, "ASUS Writer");
    assert_eq!(rows[0].media.as_deref(), Some("disk6"));
}
#[test]
fn mismatched_metadata_cannot_redirect_a_readable_source() {
    let rows = merge(Vec::new(), vec![media("disk6")], |_| {
        Some(named("disk7", "Other"))
    });
    assert_eq!(rows[0].name, "Lecteur CD 1");
    assert_eq!(rows[0].path, "disk6");
}

#[test]
fn empty_hardware_remains_visible_when_disc_recording_and_media_are_absent() {
    let mut empty = named("disk6", "ASUS Writer");
    empty.media = None;
    let rows = supplement(Vec::new(), vec![empty]);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].name, "ASUS Writer");
    assert!(rows[0].media.is_none());
    assert!(rows[0].path.starts_with("dr:IOService:/"));
}

#[test]
fn hardware_supplement_preserves_primary_names_and_avoids_duplicate_optical_drives() {
    let mut primary = named("disk6", "Primary Writer");
    primary.media = None;
    let rows = supplement(vec![primary], vec![named("disk6", "Hardware Writer")]);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].name, "Primary Writer");
    assert_eq!(rows[0].media.as_deref(), Some("disk6"));
    let mut other = named("disk6", "Other registry label");
    other.path = "dr:IOService:/Other/Optical".into();
    let rows = supplement(rows, vec![other]);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].name, "Primary Writer");
}
