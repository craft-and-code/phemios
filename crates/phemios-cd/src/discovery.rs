use super::{Disc, eject};
use cd_da_reader::CdReader;
use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};
/// One discovered optical drive or explicitly selected local image. Device paths remain native and private.
#[derive(Clone)]
pub struct Drive {
    /// Process-local selector accepted by ejection.
    pub id: String,
    /// User-visible device number, not an arbitrary filesystem path.
    pub name: String,
    /// Confirmed audio-disc selection, if readable.
    pub disc: Option<Disc>,
    /// Read failure kept distinct from an empty drive.
    pub error: Option<String>,
    /// An explicitly selected CUE/BIN image, closed without a physical eject command.
    pub image: bool,
    path: String,
}
/// Bounded source registry; optical discovery is confined to the scan operation.
#[derive(Default)]
pub struct Library {
    drives: Vec<Drive>,
    next: u64,
    gate: Arc<Mutex<()>>,
}
impl Library {
    fn token(&mut self) -> Result<String, String> {
        self.next = self
            .next
            .checked_add(1)
            .ok_or("Trop de changements de CD ; redémarrez l’application.")?;
        Ok(format!("{:016x}", self.next))
    }
    /// Last successful explicit discovery, without disk/network I/O.
    pub fn snapshot(&self) -> &[Drive] {
        &self.drives
    }
    /// Enumerate and inspect at most sixteen optical drives. Existing tokens survive an unchanged TOC.
    pub fn scan(&mut self) -> Result<&[Drive], String> {
        let gate = self.gate.clone();
        let _guard = gate.try_lock().map_err(|_| "Le lecteur CD est occupé.")?;
        let drives = super::physical::sources()?;
        if drives.len() > 16 {
            return Err("Trop de lecteurs CD détectés.".into());
        }
        let previous: BTreeMap<_, _> = self
            .drives
            .iter()
            .map(|d| (d.path.clone(), d.clone()))
            .collect();
        let mut next = Vec::new();
        for drive in drives {
            let old = previous.get(&drive.path);
            let id = match old {
                Some(d) => d.id.clone(),
                None => self.token()?,
            };
            let probe = drive
                .media
                .as_deref()
                .ok_or_else(|| "Insérez un CD audio dans le lecteur.".to_string())
                .and_then(|path| CdReader::open_path(path).map_err(|e| e.to_string()))
                .and_then(|r| r.read_toc().map(|toc| (r, toc)).map_err(|e| e.to_string()));
            let mut error = None;
            let disc = match probe {
                Ok((reader, toc)) => match Disc::inspect(
                    &reader,
                    &toc,
                    drive.media.clone().ok_or("CD absent ou inaccessible.")?,
                    self.token()?,
                    gate.clone(),
                ) {
                    Ok(mut disc) => {
                        let text = super::cdtext::Text::read(&disc.path, &disc.tracks);
                        if reader
                            .read_toc()
                            .is_ok_and(|current| disc.matches(&current))
                        {
                            disc.text = text;
                        }
                        // Reading optional names again must not invalidate queued references for an unchanged TOC.
                        if let Some(old) = old
                            .and_then(|d| d.disc.as_ref())
                            .filter(|d| d.matches(&toc))
                        {
                            disc.token = old.token.clone();
                        }
                        Some(disc)
                    }
                    Err(reason) => {
                        error = Some(reason);
                        None
                    }
                },
                Err(reason) => {
                    error = Some(format!("CD absent ou inaccessible : {reason}"));
                    None
                }
            };
            next.push(Drive {
                id,
                name: drive.name,
                path: drive.path,
                disc,
                error,
                image: false,
            });
        }
        next.extend(self.drives.iter().filter(|d| d.image).cloned());
        if next.len() > 16 {
            return Err("Trop de sources CD ouvertes.".into());
        }
        self.drives = next;
        Ok(&self.drives)
    }
    /// Open a selected audio CUE/BIN image transactionally, retaining at most one image.
    pub fn open_image(&mut self, path: &std::path::Path) -> Result<String, String> {
        if self.drives.iter().filter(|d| !d.image).count() >= 16 {
            return Err("Trop de sources CD ouvertes.".into());
        }
        let id = self.token()?;
        let disc = super::image::Image::open(path, self.token()?)?;
        if let Some(old) = self
            .drives
            .iter()
            .find(|d| d.image && d.disc.as_ref().is_some_and(|old| old.same_image(&disc)))
        {
            return Ok(old.id.clone());
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("CUE/BIN")
            .chars()
            .take(90)
            .collect::<String>();
        let drive = Drive {
            id: id.clone(),
            name,
            path: disc.path.clone(),
            disc: Some(disc),
            error: None,
            image: true,
        };
        self.drives.retain(|d| !d.image);
        self.drives.push(drive);
        Ok(id)
    }
    /// Reload only the selected image, without enumerating or touching physical readers.
    pub fn refresh_image(&mut self, id: &str) -> Result<bool, String> {
        let Some(index) = self.drives.iter().position(|d| d.id == id && d.image) else {
            return Ok(false);
        };
        let path = self.drives[index]
            .disc
            .as_ref()
            .and_then(|disc| disc.image.as_ref())
            .ok_or("Image CD indisponible.")?
            .path
            .clone();
        let mut disc = super::image::Image::open(&path, self.token()?)?;
        if let Some(old) = self.drives[index]
            .disc
            .as_ref()
            .filter(|old| old.same_image(&disc))
        {
            disc.token = old.token.clone();
        }
        self.drives[index].disc = Some(disc);
        Ok(true)
    }
    /// Admit a previously discovered disc token; the webview never supplies a device path.
    pub fn disc(&self, token: &str) -> Result<Disc, String> {
        self.drives
            .iter()
            .filter_map(|d| d.disc.as_ref())
            .find(|d| d.token == token)
            .cloned()
            .ok_or_else(|| "Le CD a changé. Actualisez la liste des lecteurs.".into())
    }
    /// Explicitly eject one previously discovered drive; no source audio is written.
    pub fn eject(&mut self, id: &str) -> Result<(), String> {
        if let Some(index) = self.drives.iter().position(|d| d.id == id && d.image) {
            self.drives.remove(index);
            return Ok(());
        }
        let gate = self.gate.clone();
        let _guard = super::access::lock(&gate, || true)?;
        let drive = self
            .drives
            .iter_mut()
            .find(|d| d.id == id)
            .ok_or("Lecteur CD inconnu.")?;
        eject::run(&drive.path)?;
        drive.disc = None;
        drive.error = None;
        Ok(())
    }
}
