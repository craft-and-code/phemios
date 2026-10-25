use super::*;
#[test]
fn metadata_follows_physical_numbers_and_rejects_invalid_strings() {
    let tracks = [
        super::super::Track {
            number: 3,
            frames: 588,
            start: 0,
        },
        super::super::Track {
            number: 7,
            frames: 588,
            start: 1,
        },
    ];
    let mut rows = vec![(None, None); 8];
    rows[0] = (Some("  Concert été  ".into()), Some("Ensemble".into()));
    rows[1] = (Some("Not an audio track".into()), None);
    rows[3] = (Some("Ouverture".into()), None);
    rows[7] = (Some("Bad\nname".into()), Some("x".repeat(513)));
    let text = Text::rows(rows, &tracks);
    assert_eq!(text.title.as_deref(), Some("Concert été"));
    assert_eq!(text.performer.as_deref(), Some("Ensemble"));
    assert!(!text.names.contains_key(&1));
    assert_eq!(text.names[&3].0.as_deref(), Some("Ouverture"));
    assert_eq!(text.names[&7], (None, None));
    assert!(
        Text::rows(vec![(None, None); 101], &tracks)
            .names
            .is_empty()
    );
}
