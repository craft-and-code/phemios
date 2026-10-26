//! System-tool fallback for an exact discovered optical device that DiscRecording cannot resolve.
use super::{
    macos,
    macos_registry::{self, Hardware},
};
use std::process::Command;
/// Only a fresh, unique vendor/product selector may target drutil; never use a mutable drive index/default.
pub(super) fn eject(registry: &str) -> Result<(), String> {
    let rows = macos_registry::inventory()?;
    let selector = selector(registry, &rows)?;
    super::eject::execute(command(selector)?)
}
fn selector<'a>(registry: &str, rows: &'a [Hardware]) -> Result<&'a str, String> {
    if !macos::valid_registry(registry) {
        return Err("Lecteur CD invalide.".into());
    }
    let path = format!("dr:{registry}");
    let mut matches = rows.iter().filter(|row| row.source.path == path);
    let target = matches
        .next()
        .ok_or("Le lecteur CD est absent ou inaccessible.")?;
    if matches.next().is_some() {
        return Err("Identité du lecteur CD ambiguë.".into());
    }
    for candidate in [target.product.as_deref(), target.vendor.as_deref()]
        .into_iter()
        .flatten()
    {
        if valid_selector(candidate)
            && rows
                .iter()
                .filter(|row| {
                    row.product
                        .as_deref()
                        .is_some_and(|name| name.eq_ignore_ascii_case(candidate))
                        || row
                            .vendor
                            .as_deref()
                            .is_some_and(|name| name.eq_ignore_ascii_case(candidate))
                })
                .count()
                == 1
        {
            return Ok(candidate);
        }
    }
    Err("Plusieurs lecteurs CD ne peuvent pas être distingués pour l’éjection système.".into())
}
fn valid_selector(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 400
        && value.trim() == value
        && !value.chars().any(char::is_control)
        // drutil accepts strtol-style prefixes: "1model" and "+1model" select index 1.
        && !value.starts_with(['-', '+'])
        && !value.as_bytes().first().is_some_and(u8::is_ascii_digit)
        && ![
            "internal", "external", "usb", "firewire", "atapi", "scsi", "all", "default",
        ]
        .contains(&value.to_ascii_lowercase().as_str())
}
fn command(selector: &str) -> Result<Command, String> {
    if !valid_selector(selector) {
        return Err("Cible d’éjection du lecteur CD invalide.".into());
    }
    let mut command = Command::new("/usr/bin/drutil");
    command.args(["-drive", selector, "tray", "eject"]);
    Ok(command)
}
#[cfg(test)]
#[path = "macos_tray_tests.rs"]
mod tests;
