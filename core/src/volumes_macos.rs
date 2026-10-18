//! Fixed macOS disk operations; identities are captured from diskutil and rechecked before ejection.
use super::{Volume, ipod, output, plist};
use serde_json::Value;
use std::time::Duration;
fn info(path: &str, timeout: Duration) -> Result<Value, String> {
    plist::parse(&output(
        "/usr/sbin/diskutil",
        &["info", "-plist", path],
        timeout,
    )?)
}
fn disk(value: &Value) -> Result<&str, String> {
    value["DeviceIdentifier"]
        .as_str()
        .filter(|s| {
            s.starts_with("disk")
                && s.len() <= 32
                && s[4..].bytes().all(|b| b.is_ascii_digit() || b == b's')
                && s.as_bytes().get(4).is_some_and(u8::is_ascii_digit)
        })
        .ok_or_else(|| "Identité du lecteur invalide.".into())
}
pub(super) fn decorate(
    volume: &mut Volume,
    usb: Option<&Value>,
    timeout: Duration,
) -> Result<bool, String> {
    let value = info(&volume.path, timeout)?;
    if !plist::external(&value)? {
        return Ok(false);
    }
    let id = disk(&value)?.to_owned();
    volume.ejectable =
        value["Ejectable"] == true && value["MountPoint"].as_str() == Some(&volume.path);
    volume.device = Some(id.clone());
    if let Some(model) = usb.and_then(|tree| ipod::identify(tree, &id)) {
        volume.model = Some(model.name);
        volume.icon = model.icon;
        volume.ipod_supported = Some(model.supported);
    }
    Ok(true)
}
pub(super) fn usb_tree() -> Option<Value> {
    output(
        "/usr/sbin/ioreg",
        &["-a", "-l", "-r", "-c", "IOUSBHostDevice"],
        Duration::from_secs(2),
    )
    .ok()
    .and_then(|bytes| plist::parse(&bytes).ok())
}
fn eject_id(volume: &Volume, value: &Value) -> Result<String, String> {
    if !volume.ejectable
        || !plist::external(value)?
        || value["Ejectable"] != true
        || value["MountPoint"].as_str() != Some(&volume.path)
        || volume.device.as_deref() != Some(disk(value)?)
    {
        return Err("Le lecteur a changé ou ne peut pas être éjecté.".into());
    }
    Ok(format!("/dev/{}", disk(value)?))
}
pub(super) fn eject(
    volume: &Volume,
    confirm: impl Fn() -> Result<(), String>,
) -> Result<(), String> {
    let value = info(&volume.path, Duration::from_secs(3))?;
    let device = eject_id(volume, &value)?;
    confirm()?;
    output("/usr/sbin/diskutil", &["eject", &device], Duration::from_secs(15))
        .map(|_| ())
        .map_err(|_| "Éjection refusée ou interrompue. Vérifiez le lecteur dans le système avant de le débrancher.".into())
}
#[cfg(test)]
#[path = "volumes_macos_tests.rs"]
mod tests;
