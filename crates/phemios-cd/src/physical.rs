//! Native-discovered identity is separate from the optional readable media path.
pub(super) struct Source {
    pub path: String,
    pub name: String,
    pub media: Option<String>,
}
pub(super) fn sources() -> Result<Vec<Source>, String> {
    let media = cd_da_reader::CdReader::list_drives()
        .map_err(|_| "Détection des lecteurs CD impossible.")?;
    #[cfg(target_os = "macos")]
    let sources = match super::macos::devices() {
        Ok(primary) => supplement(
            primary,
            super::macos_registry::devices().unwrap_or_default(),
        ),
        Err(error) => {
            let hardware = super::macos_registry::devices().unwrap_or_default();
            if hardware.is_empty() {
                return Err(error);
            }
            hardware
        }
    };
    #[cfg(not(target_os = "macos"))]
    let sources: Vec<Source> = Vec::new();
    #[cfg(target_os = "macos")]
    let resolve = |path: &str| {
        super::macos::source_for_bsd(path).or_else(|| {
            // DiscRecording can omit devices in an unbundled development process.
            // Keep the native BSD identity/ejection path if only diskutil supplies its name.
            super::macos_info::name(path).map(|name| Source {
                path: path.to_owned(),
                name,
                media: Some(path.to_owned()),
            })
        })
    };
    #[cfg(not(target_os = "macos"))]
    let resolve = |_: &str| None;
    Ok(merge(sources, media, resolve))
}
// Keep hardware-only sources even when no readable media was enumerated.
#[cfg(any(target_os = "macos", test))]
fn supplement(mut primary: Vec<Source>, hardware: Vec<Source>) -> Vec<Source> {
    for source in hardware {
        if let Some(known) = primary.iter_mut().find(|row| {
            row.path == source.path || (row.media.is_some() && row.media == source.media)
        }) {
            if known.media.is_none() {
                known.media = source.media;
            }
        } else {
            primary.push(source);
        }
    }
    primary
}
// Keep source enumeration separate from the platform name resolution seam.
fn merge(
    mut sources: Vec<Source>,
    media: Vec<cd_da_reader::DriveInfo>,
    resolve: impl Fn(&str) -> Option<Source>,
) -> Vec<Source> {
    // Retain readable non-writer drives that DiscRecording does not enumerate.
    for drive in media {
        if !sources
            .iter()
            .any(|s| s.media.as_ref() == Some(&drive.path))
        {
            let source = resolve(&drive.path)
                .filter(|source| source.media.as_deref() == Some(drive.path.as_str()))
                .unwrap_or_else(|| Source {
                    name: format!("Lecteur CD {}", sources.len() + 1),
                    media: Some(drive.path.clone()),
                    path: drive.path,
                });
            // DiscRecording may know the writer before its media status supplies a BSD name.
            if let Some(existing) = sources.iter_mut().find(|row| row.path == source.path) {
                *existing = source;
            } else {
                sources.push(source);
            }
        }
    }
    sources
}
#[cfg(test)]
#[path = "physical_tests.rs"]
mod tests;
