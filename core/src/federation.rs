//! Application-only reference namespaces preserve the engine's original identities.
use serde_json::Value;
/// An explicit catalog owner; remote and local identities never collide.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Source {
    /// App-owned embedded engine.
    Local,
    /// Explicitly connected remote engine.
    Server,
}
impl Source {
    /// Validate the narrow IPC source vocabulary.
    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "local" => Ok(Self::Local),
            "server" => Ok(Self::Server),
            _ => Err("Origine de bibliothèque invalide.".into()),
        }
    }
    /// Stable non-secret owner marker.
    pub fn name(self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::Server => "server",
        }
    }
}
fn entity_kind(kind: &str) -> bool {
    matches!(
        kind,
        "artist" | "release" | "track" | "recording" | "work" | "release_group" | "label" | "genre"
    )
}
/// Qualify only an engine identity, preserving its entity kind.
pub fn qualify(reference: &str, source: Source) -> String {
    match reference.split_once(':') {
        Some((kind, suffix)) if entity_kind(kind) => {
            format!("{kind}:@phemios/{}/{suffix}", source.name())
        }
        _ => reference.into(),
    }
}
/// Unwrap an application identity. Legacy raw references belong to the remote server.
/// Only a marker immediately after the entity kind is structural; keys remain literal.
pub fn resolve(reference: &str) -> Result<(Source, String), String> {
    let Some((kind, key)) = reference.split_once(':') else {
        return Ok((Source::Server, reference.into()));
    };
    let Some(rest) = key.strip_prefix("@phemios/") else {
        return Ok((Source::Server, reference.into()));
    };
    let (source, suffix) = rest
        .split_once('/')
        .ok_or("Référence de bibliothèque invalide.")?;
    if suffix.is_empty() {
        return Err("Référence de bibliothèque invalide.".into());
    }
    Ok((Source::parse(source)?, format!("{kind}:{suffix}")))
}
fn identity_key(key: &str) -> bool {
    matches!(
        key,
        "items"
            | "reference"
            | "ref"
            | "release"
            | "track"
            | "artist"
            | "recording"
            | "work"
            | "label"
            | "labels"
            | "release_refs"
            | "contributors"
            | "tracks"
            | "albums"
            | "releases"
            | "artists"
    )
}
/// Rewrite schema identity slots only; notes, tags, filenames and source claims remain exact.
pub fn map(value: &mut Value, source: Source, incoming: bool) -> Result<(), String> {
    fn walk(value: &mut Value, key: &str, source: Source, incoming: bool) -> Result<(), String> {
        match value {
            Value::Object(fields) => {
                for (key, value) in fields {
                    walk(value, key, source, incoming)?;
                }
            }
            Value::Array(rows) => {
                for row in rows {
                    walk(row, key, source, incoming)?;
                }
            }
            Value::String(text)
                if identity_key(key)
                    && text
                        .split_once(':')
                        .is_some_and(|(kind, _)| entity_kind(kind)) =>
            {
                if incoming {
                    *text = qualify(text, source);
                } else {
                    let (owner, raw) = resolve(text)?;
                    if owner != source {
                        return Err("Cette opération doit concerner une seule bibliothèque.".into());
                    }
                    *text = raw;
                }
            }
            _ => {}
        }
        Ok(())
    }
    walk(value, "", source, incoming)
}
#[cfg(test)]
#[path = "federation_tests.rs"]
mod tests;

/// Resolve and unwrap known request selectors before choosing a native client.
/// Track lyrics use `track`, while ordinary catalog routes use `ref`/`reference`.
pub fn request_origin(
    query: &mut std::collections::BTreeMap<String, String>,
    body: &mut Option<Value>,
    fallback: Source,
) -> Result<Source, String> {
    let hint = ["ref", "reference", "track"]
        .iter()
        .find_map(|key| query.get(*key).map(String::as_str))
        .or_else(|| {
            body.as_ref().and_then(|value| {
                ["release", "reference", "track"]
                    .iter()
                    .find_map(|key| value[*key].as_str())
            })
        });
    let origin = hint
        .map(resolve)
        .transpose()?
        .map_or(fallback, |value| value.0);
    for key in ["ref", "reference", "track"] {
        if let Some(reference) = query.get_mut(key) {
            let (owner, raw) = resolve(reference)?;
            if owner != origin {
                return Err("Origines incompatibles.".into());
            }
            *reference = raw;
        }
    }
    if let Some(value) = body {
        map(value, origin, false)?;
    }
    Ok(origin)
}
