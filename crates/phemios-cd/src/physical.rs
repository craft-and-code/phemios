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
    let mut sources = super::macos::devices()?;
    #[cfg(not(target_os = "macos"))]
    let mut sources: Vec<Source> = Vec::new();
    // Retain readable non-writer drives that DiscRecording does not enumerate.
    for drive in media {
        if !sources
            .iter()
            .any(|s| s.media.as_ref() == Some(&drive.path))
        {
            sources.push(Source {
                name: format!("Lecteur CD {}", sources.len() + 1),
                media: Some(drive.path.clone()),
                path: drive.path,
            });
        }
    }
    Ok(sources)
}
