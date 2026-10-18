//! A retained, owner-bound transfer job; only discovered native destinations are admitted.
use crate::aede::{Aede, blocking, bridge, client};
use phemios_core::{
    federation::{self, Source},
    network::Client,
};
use phemios_transfer::{Mounted, MtpTarget};
use serde_json::{Value, json};
use std::{
    path::PathBuf,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
};
use tauri::{AppHandle, Manager, State};
#[path = "transfer_job.rs"]
mod job;
#[derive(Clone)]
pub(crate) enum Target {
    Mounted(Mounted),
    Mtp(MtpTarget),
}
#[derive(Clone)]
pub(crate) struct Owner {
    client: Client,
    session: Arc<Mutex<Option<Client>>>,
    generation: Arc<AtomicU64>,
    ticket: String,
}
impl Owner {
    fn confirm(&self) -> Result<(), String> {
        crate::sessions::with_current(
            &self.session,
            &self.generation,
            &self.ticket,
            &self.client,
            || Ok(()),
        )
    }
}
#[derive(Clone)]
pub(crate) struct Item {
    owner: Owner,
    reference: String,
    stamp: String,
    relative: PathBuf,
    bytes: u64,
}
pub(crate) struct Preview {
    id: String,
    target: Target,
    items: Vec<Item>,
    options: Value,
    bytes: u64,
}
#[derive(Default)]
pub(crate) struct Transfers {
    pub(crate) targets: Mutex<Vec<(String, Target)>>,
    pub(crate) discovery: Mutex<()>,
    pub(crate) inventory: Mutex<Value>,
    preview: Mutex<Option<Preview>>,
    pub(crate) running: AtomicBool,
    cancel: AtomicBool,
    status: Mutex<Value>,
    owners: Mutex<Vec<Owner>>,
    pub(crate) serial: AtomicU64,
}
impl Transfers {
    fn status(&self) -> Result<Value, String> {
        if self
            .owners
            .lock()
            .map_err(|_| "Transfert occupé.")?
            .iter()
            .any(|o| o.confirm().is_err())
        {
            self.cancel.store(true, Ordering::Release);
            return Ok(json!({"phase":"idle","running":self.running.load(Ordering::Acquire)}));
        }
        let mut status = self.status.lock().map_err(|_| "Transfert occupé.")?.clone();
        if !status.is_object() {
            status = json!({"phase":"idle"});
        }
        status["running"] = self.running.load(Ordering::Acquire).into();
        Ok(status)
    }
    fn update(&self, value: Value) {
        if let Ok(mut status) = self.status.lock() {
            *status = value;
        }
    }
}
#[tauri::command]
pub(crate) async fn transfer_prepare(
    version: u32,
    destination: String,
    references: Vec<String>,
    options: Value,
    expected_sessions: Value,
    state: State<'_, Aede>,
    transfer: State<'_, Arc<Transfers>>,
) -> Result<Value, String> {
    bridge(version)?;
    if references.is_empty() || references.len() > 4096 || transfer.running.load(Ordering::Acquire)
    {
        return Err("Sélection vide, trop grande ou transfert en cours.".into());
    }
    job::options(&options)?;
    let target = transfer
        .targets
        .lock()
        .map_err(|_| "Lecteurs indisponibles.")?
        .iter()
        .find(|(id, _)| *id == destination)
        .map(|(_, t)| t.clone())
        .ok_or("Actualisez puis sélectionnez le lecteur.")?;
    let mut selected = Vec::new();
    let mut seen = std::collections::BTreeSet::new();
    for reference in references {
        if reference.len() > 4096 || !reference.starts_with("track:") {
            return Err("Sélection audio invalide.".into());
        }
        if !seen.insert(reference.clone()) {
            continue;
        }
        let (source, raw) = federation::resolve(&reference)?;
        let owner = state.owner(source);
        let expected = expected_sessions[source.name()]
            .as_str()
            .ok_or("Session de transfert indisponible.")?
            .to_owned();
        let owner = Owner {
            client: client(owner)?,
            session: owner.session.clone(),
            generation: owner.generation.clone(),
            ticket: expected,
        };
        owner.confirm()?;
        selected.push((source, raw, owner));
    }
    let transfer = transfer.inner().clone();
    blocking(move || {
        if let Target::Mounted(mount) = &target {
            mount.confirm()?;
            if mount.apple_ipod() && !phemios_transfer::podkit_available() { return Err("Installez podkit pour transférer vers un iPod Apple compatible.".into()); }
        }
        if matches!(&target,Target::Mtp(_)) && options["replace"] == true { return Err("Le remplacement de fichiers MTP existants n’est pas disponible.".into()); }
        if matches!(&target,Target::Mounted(m) if m.apple_ipod()) && (options["format"] != "original" || options["verify"] != false || options["replace"] != false) { return Err("Utilisez le profil automatique iPod sans remplacement ni vérification octet par octet.".into()); }
        let mut items = Vec::new(); let mut bytes = 0u64; let mut paths = std::collections::BTreeSet::new();
        for source in [Source::Local, Source::Server] {
            let rows: Vec<_> = selected.iter().filter(|(s,_,_)| *s == source).collect();
            let mut scanned_at = None;
            let mut offset=0;
            while offset<rows.len() {
                let mut end=offset; let mut budget=32;
                while end<rows.len().min(offset+200) {
                    let size=serde_json::to_string(&rows[end].1).map_err(|_|"Référence de transfert invalide.")?.len()+1;
                    if budget+size>14*1024 {break;}
                    budget+=size;end+=1;
                }
                if end==offset {return Err("Référence de transfert trop grande.".into());}
                let batch=&rows[offset..end];offset=end;
                let owner = &batch[0].2;
                owner.confirm()?;
                owner.client.require_unrestricted_download()?;
                if scanned_at.is_none() {
                    let status = owner.client.request("GET", "/api/v1/status", &[], None)?;
                    if !status["capabilities"].as_array().is_some_and(|v| v.iter().any(|v| v == "original_exports")) { return Err("Mettez à jour puis redémarrez Aède pour transférer les originaux audio.".into()); }
                }
                let references: Vec<_> = batch.iter().map(|(_,r,_)| r.as_str()).collect();
                let value = owner.client.request("POST", "/api/me/v1/exports/plan", &[], Some(&json!({"references":references})))?;
                owner.confirm()?;
                let stamp = value["scanned_at"].as_u64().ok_or("Plan de copie invalide ; mettez à jour Aède.")?;
                if scanned_at.is_some_and(|previous| previous != stamp) { return Err("Le catalogue a changé ; recommencez l’aperçu.".into()); }
                scanned_at = Some(stamp);
                let roots: Vec<String> = value["roots"].as_array().ok_or("Racines de copie invalides.")?.iter().map(|v| v.as_str().map(str::to_owned).ok_or("Racine de copie invalide.")).collect::<Result<_,_>>()?;
                if let Target::Mounted(mount) = &target { mount.outside(&roots)?; }
                let returned = value["items"].as_array().filter(|r| r.len() == batch.len()).ok_or("Plan de copie incomplet.")?;
                for (row, expected) in returned.iter().zip(batch) {
                    if row["reference"] != expected.1 { return Err("Identité de copie invalide.".into()); }
                    let parts: Vec<String> = row["components"].as_array().ok_or("Chemin de copie absent.")?.iter().map(|v| v.as_str().map(str::to_owned).ok_or("Chemin de copie invalide.")).collect::<Result<_,_>>()?;
                    let mut relative = phemios_transfer::relative(&parts)?;
                    // Both libraries may contain identically named releases; keep the origins separate.
                    if selected.iter().any(|(s,_,_)| *s != source) { relative = PathBuf::from(source.name()).join(relative); }
                    let mut key:Vec<String>=row["key"].as_array().filter(|v| v.len()==parts.len()).ok_or("Clé de copie invalide.")?.iter().map(|v|v.as_str().filter(|v|v.len()<=1024).map(str::to_owned).ok_or("Clé de copie invalide.")).collect::<Result<_,_>>()?;
                    if selected.iter().any(|(s,_,_)|*s!=source){key.insert(0,source.name().into());}
                    if !paths.insert(key) { return Err("Plusieurs pistes partagent le même chemin de destination. Réduisez la sélection.".into()); }
                    let size = row["bytes"].as_u64().filter(|v| *v > 0 && *v <= 64 * 1024 * 1024 * 1024).ok_or("Taille de copie invalide.")?;
                    bytes = bytes.checked_add(size).ok_or("Sélection trop volumineuse.")?;
                    items.push(Item { owner: owner.clone(), reference: expected.1.clone(), stamp: row["stamp"].as_str().filter(|v| v.len() <= 128).ok_or("Version de fichier absente.")?.to_owned(), relative, bytes:size });
                }
            }
        }
        let id = transfer.serial.fetch_add(1, Ordering::Relaxed).to_string();
        let result = json!({"id":id,"tracks":items.len(),"bytes":bytes,"destination":destination,"ipod":matches!(&target, Target::Mounted(m) if m.apple_ipod()),"files":items.iter().take(30).map(|i| i.relative.to_string_lossy()).collect::<Vec<_>>()});
        *transfer.preview.lock().map_err(|_| "Aperçu occupé.")? = Some(Preview { id, target, items, options, bytes });
        Ok(result)
    }).await
}
#[tauri::command]
pub(crate) async fn transfer_start(
    version: u32,
    id: String,
    app: AppHandle,
    state: State<'_, Aede>,
    transfer: State<'_, Arc<Transfers>>,
) -> Result<Value, String> {
    bridge(version)?;
    let _discovery = transfer
        .discovery
        .try_lock()
        .map_err(|_| "Attendez la fin de la détection des lecteurs.")?;
    let preview = transfer
        .preview
        .lock()
        .map_err(|_| "Aperçu occupé.")?
        .take()
        .filter(|p| p.id == id)
        .ok_or("Recréez l’aperçu avant le transfert.")?;
    for item in &preview.items {
        item.owner.confirm()?;
    }
    let executable = state
        .engine
        .lock()
        .map_err(|_| "Moteur occupé.")?
        .copy_executable();
    let root = app
        .path()
        .app_cache_dir()
        .map_err(|_| "Cache de transfert indisponible.")?
        .join("transfers");
    let mut owners = transfer.owners.lock().map_err(|_| "Transfert occupé.")?;
    if transfer
        .running
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Err("Un transfert est déjà en cours.".into());
    }
    owners.clear();
    for item in &preview.items {
        if !owners
            .iter()
            .any(|o| o.client.same_session(&item.owner.client))
        {
            owners.push(item.owner.clone());
        }
    }
    drop(owners);
    transfer.cancel.store(false, Ordering::Release);
    transfer.update(
        json!({"phase":"preparing","done":0,"total":preview.items.len(),"bytes":preview.bytes}),
    );
    let transfer = transfer.inner().clone();
    std::thread::spawn(move || job::run(transfer, preview, executable, root));
    Ok(json!({"started":true}))
}
#[tauri::command]
pub(crate) fn transfer_status(
    version: u32,
    transfer: State<'_, Arc<Transfers>>,
) -> Result<Value, String> {
    bridge(version)?;
    transfer.status()
}
#[tauri::command]
pub(crate) fn transfer_cancel(
    version: u32,
    transfer: State<'_, Arc<Transfers>>,
) -> Result<(), String> {
    bridge(version)?;
    transfer.cancel.store(true, Ordering::Release);
    Ok(())
}
