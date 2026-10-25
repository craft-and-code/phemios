//! Optional on-disc names are bounded, never catalogue identities or prerequisites for playing a valid TOC.
#[cfg(target_os = "linux")]
use super::linux_cdtext as transport;
#[cfg(target_os = "macos")]
use super::macos_cdtext as transport;
#[cfg(target_os = "windows")]
use super::windows_cdtext as transport;
use std::collections::BTreeMap;
#[derive(Clone, Default)]
pub(super) struct Text {
    pub title: Option<String>,
    pub performer: Option<String>,
    pub names: BTreeMap<u8, (Option<String>, Option<String>)>,
}
#[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows", test))]
fn clean(text: Option<String>) -> Option<String> {
    let text = text?;
    let text = text.trim();
    (!text.is_empty() && text.chars().count() <= 512 && !text.chars().any(char::is_control))
        .then(|| text.into())
}
impl Text {
    #[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows", test))]
    pub fn rows(rows: Vec<(Option<String>, Option<String>)>, tracks: &[super::Track]) -> Self {
        let mut text = Self::default();
        if rows.len() > 100 {
            return text;
        }
        for (number, (title, performer)) in rows.into_iter().enumerate() {
            let names = (clean(title), clean(performer));
            if number == 0 {
                (text.title, text.performer) = names;
            } else if tracks
                .iter()
                .any(|track| usize::from(track.number) == number)
            {
                text.names.insert(number as u8, names);
            }
        }
        text
    }
    pub fn read(path: &str, tracks: &[super::Track]) -> Self {
        #[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows"))]
        if let Some(rows) = transport::read(path) {
            return Self::rows(rows, tracks);
        }
        let _ = (path, tracks);
        Self::default()
    }
}
#[cfg(test)]
#[path = "cdtext_tests.rs"]
mod tests;
