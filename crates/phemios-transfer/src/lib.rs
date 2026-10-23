//! Explicit additive portable-player transfers. Catalog selection and credentials stay in the host.
#![warn(missing_docs)]
mod guard;
mod ipod;
mod mounted;
mod mtp;
mod process;
pub use guard::DestinationGuard;
pub use ipod::{podkit_available, sync_ipod};
pub use mounted::Mounted;
pub use mtp::{MtpTarget, discover_mtp};
pub use process::run_engine;
use std::path::{Component, Path, PathBuf};
/// Refuse remote paths, drive syntax and traversal even when a server returned the components.
pub fn relative(components: &[String]) -> Result<PathBuf, String> {
    if components.is_empty() || components.len() > 32 {
        return Err("Chemin de transfert invalide.".into());
    }
    let mut path = PathBuf::new();
    for part in components {
        let stem = part.split('.').next().unwrap_or("").to_ascii_uppercase();
        let reserved = matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
            || stem
                .strip_prefix("COM")
                .or_else(|| stem.strip_prefix("LPT"))
                .is_some_and(|n| n.len() == 1 && matches!(n.as_bytes()[0], b'1'..=b'9'));
        if reserved
            || part.ends_with(['.', ' '])
            || part.contains(['?', '*', '<', '>', '|', '"'])
            || part.is_empty()
            || part.len() > 255
            || part.contains(['/', '\\', ':', '\0'])
            || part.chars().any(char::is_control)
            || !matches!(
                Path::new(part).components().collect::<Vec<_>>().as_slice(),
                [Component::Normal(_)]
            )
        {
            return Err("Chemin de transfert invalide.".into());
        }
        path.push(part);
    }
    Ok(path)
}
#[cfg(test)]
#[path = "lib_tests.rs"]
mod tests;
