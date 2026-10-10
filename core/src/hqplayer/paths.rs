//! Explicit shared-folder mapping; source paths come only from authenticated Aède details.
use serde_json::Value;
fn valid(path: &str) -> bool {
    path.starts_with('/')
        && path.len() <= 4096
        && !path.chars().any(char::is_control)
        && !path.split('/').any(|p| matches!(p, ".." | "."))
}
pub(super) fn uri(path: &str, mappings: &Value) -> Result<String, String> {
    if !valid(path) {
        return Err(
            "HQPlayer nécessite des chemins absolus de dossiers partagés compatibles POSIX.".into(),
        );
    }
    let rows = mappings
        .as_array()
        .filter(|r| r.len() <= 16)
        .ok_or("Correspondance de dossiers HQPlayer invalide.")?;
    let mut selected = path.to_owned();
    let mut longest = 0;
    for row in rows {
        let from = row["from"]
            .as_str()
            .ok_or("Correspondance HQPlayer invalide.")?
            .trim_end_matches('/');
        let to = row["to"]
            .as_str()
            .ok_or("Correspondance HQPlayer invalide.")?
            .trim_end_matches('/');
        if !valid(from) || !valid(to) {
            return Err("Correspondance HQPlayer invalide.".into());
        };
        if from.len() > longest
            && (path == from
                || path
                    .strip_prefix(from)
                    .is_some_and(|suffix| suffix.starts_with('/')))
        {
            selected = format!("{to}{}", &path[from.len()..]);
            longest = from.len();
        }
    }
    let mut escaped = String::from("file://");
    for byte in selected.bytes() {
        if byte.is_ascii_alphanumeric() || b"/-._~".contains(&byte) {
            escaped.push(char::from(byte));
        } else {
            escaped.push_str(&format!("%{byte:02X}"));
        }
    }
    Ok(escaped)
}
