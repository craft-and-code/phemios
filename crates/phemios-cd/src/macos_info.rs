//! Optional read-only model lookup when DiscRecording omits a readable native drive.
use super::{macos, macos_cf as cf, process::Process};
use std::process::{Command, Stdio};
fn command(path: &str) -> Option<Command> {
    if !macos::valid_bsd(path) {
        return None;
    }
    let mut command = Command::new("/usr/sbin/diskutil");
    command.args(["info", "-plist", path]).stdin(Stdio::null());
    Some(command)
}
/// Only native-enumerated BSD identities reach the fixed executable, never a shell or a user path.
pub(super) fn name(path: &str) -> Option<String> {
    let mut child = Process::spawn(command(path)?, 2048).ok()?;
    let response = child.text().ok()?;
    parse(response.as_bytes(), path)
}
fn parse(bytes: &[u8], path: &str) -> Option<String> {
    if !macos::valid_bsd(path) {
        return None;
    }
    let root = cf::property_list(bytes)?;
    let key = cf::string("DeviceIdentifier")?;
    if cf::text(cf::get(root.0, key.0)).as_deref() != Some(path) {
        return None;
    }
    let key = cf::string("MediaName")?;
    let name = cf::text(cf::get(root.0, key.0))?;
    let name = name.trim();
    if name.is_empty() || name.chars().any(char::is_control) {
        return None;
    }
    Some(name.chars().take(100).collect())
}
#[cfg(test)]
#[path = "macos_info_tests.rs"]
mod tests;
