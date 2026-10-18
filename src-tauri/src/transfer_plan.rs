//! Project server-owned conversion names without treating source extensions as codecs.
use serde_json::Value;
use std::{collections::BTreeSet, path::PathBuf};
const INVALID: &str = "Plan de conversion invalide ; mettez à jour Aède.";
/// Original components remain staging identities; only the preview/collision namespace uses outputs.
pub(super) fn output(
    row: &Value,
    original: &[String],
    converted: bool,
) -> Result<(PathBuf, Vec<String>), String> {
    let parts = if converted {
        row["output_components"]
            .as_array()
            .filter(|parts| parts.len() == original.len() && !parts.is_empty())
            .ok_or(INVALID)?
            .iter()
            .map(|part| part.as_str().map(str::to_owned).ok_or(INVALID))
            .collect::<Result<Vec<_>, _>>()?
    } else {
        original.to_vec()
    };
    if original.is_empty() || parts[..parts.len() - 1] != original[..original.len() - 1] {
        return Err(INVALID.into());
    }
    let relative = phemios_transfer::relative(&parts)?;
    let field = if converted { "output_key" } else { "key" };
    let key = row[field]
        .as_array()
        .filter(|keys| keys.len() == parts.len())
        .ok_or(INVALID)?
        .iter()
        .map(|key| {
            key.as_str()
                .filter(|key| key.len() <= 1024)
                .map(str::to_owned)
                .ok_or(INVALID)
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok((relative, key))
}
/// Converted paths may collide even when original extensions differ, including file/directory aliases.
pub(super) fn admit(paths: &mut BTreeSet<Vec<String>>, key: Vec<String>) -> Result<(), String> {
    if key.is_empty()
        || (1..key.len()).any(|end| paths.contains(&key[..end]))
        || paths
            .range(key.clone()..)
            .next()
            .is_some_and(|existing| existing.starts_with(&key))
    {
        return Err("Plusieurs pistes partagent le même chemin de destination après conversion. Réduisez la sélection.".into());
    }
    paths.insert(key);
    Ok(())
}
#[cfg(test)]
#[path = "transfer_plan_tests.rs"]
mod tests;
