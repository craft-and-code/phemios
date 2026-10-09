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
/// Qualify only an engine identity, preserving its entity kind.
pub fn qualify(reference: &str, source: Source) -> String {
    match reference.split_once(':') {
        Some((kind, suffix))
            if matches!(
                kind,
                "artist" | "release" | "track" | "recording" | "work" | "label"
            ) =>
        {
            format!("{kind}:@phemios/{}/{suffix}", source.name())
        }
        _ => reference.into(),
    }
}
/// Unwrap an application identity. Legacy raw references belong to the remote server.
pub fn resolve(reference: &str) -> Result<(Source, String), String> {
    let Some((kind, rest)) = reference.split_once(":@phemios/") else {
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
                    && text.split_once(':').is_some_and(|(kind, _)| {
                        matches!(
                            kind,
                            "artist" | "release" | "track" | "recording" | "work" | "label"
                        )
                    }) =>
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
