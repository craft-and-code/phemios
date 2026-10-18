//! Serial transfer orchestration: at most one original and one derivative are staged.
use super::*;
use std::{fs, path::Path};
pub(super) fn options(value: &Value) -> Result<(), String> {
    if value.as_object().is_none_or(|v| v.len() != 3)
        || !matches!(
            value["format"].as_str(),
            Some("original" | "mp3" | "aac" | "opus" | "flac" | "wav")
        )
        || !value["verify"].is_boolean()
        || !value["replace"].is_boolean()
    {
        return Err("Options de transfert invalides.".into());
    }
    Ok(())
}
struct Workspace(PathBuf);
impl Drop for Workspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn workspace(root: &Path) -> Result<Workspace, String> {
    // The root is app-owned and exclusive creation prevents another job from redirecting a file.
    fs::create_dir_all(root).map_err(|_| "Cache de transfert indisponible.")?;
    let metadata = fs::symlink_metadata(root).map_err(|_| "Cache de transfert indisponible.")?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err("Cache de transfert non sécurisé.".into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(root, fs::Permissions::from_mode(0o700))
            .map_err(|_| "Permissions de transfert indisponibles.")?;
    }
    let mut random = [0; 16];
    getrandom_bytes(&mut random)?;
    let path = root.join(
        random
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>(),
    );
    let mut builder = fs::DirBuilder::new();
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    builder
        .create(&path)
        .map_err(|_| "Cache de transfert occupé.")?;
    Ok(Workspace(path))
}
fn getrandom_bytes(bytes: &mut [u8]) -> Result<(), String> {
    // Engine certificates already expose a native random source through this bounded helper.
    phemios_core::transfer_random(bytes)
}
pub(super) fn run(transfer: Arc<Transfers>, preview: Preview, executable: PathBuf, root: PathBuf) {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        execute(&transfer, &preview, &executable, &root)
    }))
    .unwrap_or_else(|_| Err("Le processus de transfert a été interrompu.".into()));
    if let Err(error) = result {
        let phase = if transfer.cancel.load(Ordering::Acquire) {
            "canceled"
        } else {
            "failed"
        };
        let mut status = transfer.status.lock().unwrap_or_else(|e| e.into_inner());
        status["phase"] = phase.into();
        status["error"] = error.into();
    } else {
        let mut status = transfer.status.lock().unwrap_or_else(|e| e.into_inner());
        status["phase"] = "complete".into();
    }
    transfer.running.store(false, Ordering::Release);
}
fn execute(
    transfer: &Transfers,
    preview: &Preview,
    executable: &Path,
    root: &Path,
) -> Result<(), String> {
    let work = workspace(root)?;
    // One staged file bounds disk use; a failed or canceled job removes its private work tree.
    for (index, item) in preview.items.iter().enumerate() {
        let valid = || {
            item.owner.confirm()?;
            if transfer.cancel.load(Ordering::Acquire) {
                return Err("Transfert arrêté. Les fichiers terminés sont conservés.".into());
            }
            Ok(())
        };
        valid()?;
        item.owner.client.require_unrestricted_download()?;
        if let Target::Mounted(mount) = &preview.target {
            mount.confirm()?;
        }
        let source = work.0.join("music");
        let data = work.0.join("catalog");
        let output = work.0.join("converted");
        fs::create_dir_all(&source).map_err(|_| "Cache de transfert indisponible.")?;
        let path = source.join(&item.relative);
        fs::create_dir_all(path.parent().ok_or("Chemin de copie invalide.")?)
            .map_err(|_| "Cache de transfert indisponible.")?;
        let update = |phase: &str, current: u64| {
            transfer.update(json!({"phase":phase,"done":index,"total":preview.items.len(),"current":item.relative.to_string_lossy(),"file_bytes":current,"file_total":item.bytes}))
        };
        update("downloading", 0);
        let published = std::cell::Cell::new(std::time::Instant::now());
        item.owner.client.export_original(
            &item.reference,
            &item.stamp,
            item.bytes,
            &path,
            &valid,
            &|n| {
                if n == item.bytes
                    || published.get().elapsed() >= std::time::Duration::from_millis(100)
                {
                    published.set(std::time::Instant::now());
                    update("downloading", n);
                }
            },
        )?;
        valid()?;
        if let Target::Mounted(mount) = &preview.target {
            if mount.apple_ipod() {
                update("ipod", item.bytes);
                // An in-flight iPod database commit is allowed to finish before canceling.
                phemios_transfer::sync_ipod(mount, &source, &work.0, "max", &|| {
                    item.owner.confirm()
                })?;
                valid()?;
            } else {
                copy(
                    executable,
                    &source,
                    &data,
                    mount.path(),
                    &preview.options,
                    &|| {
                        mount.confirm()?;
                        valid()
                    },
                    &update,
                )?;
            }
        } else if let Target::Mtp(target) = &preview.target {
            fs::create_dir(&output).map_err(|_| "Cache de conversion indisponible.")?;
            let mut options = preview.options.clone();
            options["replace"] = false.into();
            copy(
                executable, &source, &data, &output, &options, &valid, &update,
            )?;
            let files = output_files(&output)?;
            for (relative, path) in files {
                update("mtp", item.bytes);
                target.upload(&relative, &path, preview.options["verify"] == true, &valid)?;
            }
        }
        update("copying", item.bytes);
        for folder in [&source, &data, &output] {
            if folder.exists() {
                fs::remove_dir_all(folder).map_err(|_| "Nettoyage temporaire impossible.")?;
            }
        }
        transfer.update(json!({"phase":"copying","done":index+1,"total":preview.items.len()}));
    }
    Ok(())
}
fn copy(
    executable: &Path,
    source: &Path,
    data: &Path,
    destination: &Path,
    options: &Value,
    valid: &dyn Fn() -> Result<(), String>,
    update: &dyn Fn(&str, u64),
) -> Result<(), String> {
    update("preparing", 0);
    phemios_transfer::run_engine(
        executable,
        &[
            "scan".into(),
            source.to_string_lossy().into_owned(),
            format!("--data={}", data.display()),
            "--threads=1".into(),
            "--json".into(),
        ],
        valid,
    )?;
    update("copying", 0);
    let mut args = vec![
        "copy".into(),
        destination.to_string_lossy().into_owned(),
        format!("--data={}", data.display()),
        "--threads=1".into(),
        "--safe-names".into(),
        "--extras=none".into(),
    ];
    if options["format"] != "original" {
        args.push(format!(
            "--compress={}",
            options["format"].as_str().ok_or("Format invalide.")?
        ));
    }
    if options["verify"] == true {
        args.extend(["--verify".into(), "--verify-existing".into()]);
    }
    if options["replace"] == true {
        args.push("--replace".into());
    }
    phemios_transfer::run_engine(executable, &args, valid)
}
fn output_files(root: &Path) -> Result<Vec<(PathBuf, PathBuf)>, String> {
    fn walk(root: &Path, path: &Path, out: &mut Vec<(PathBuf, PathBuf)>) -> Result<(), String> {
        for entry in fs::read_dir(path).map_err(|_| "Conversion illisible.")? {
            let entry = entry.map_err(|_| "Conversion illisible.")?;
            let kind = entry.file_type().map_err(|_| "Conversion illisible.")?;
            if kind.is_symlink() {
                return Err("Lien symbolique refusé dans la conversion.".into());
            }
            if kind.is_dir() {
                walk(root, &entry.path(), out)?;
            } else if kind.is_file() {
                out.push((
                    entry
                        .path()
                        .strip_prefix(root)
                        .map_err(|_| "Conversion invalide.")?
                        .to_owned(),
                    entry.path(),
                ));
            }
        }
        Ok(())
    }
    let mut files = Vec::new();
    walk(root, root, &mut files)?;
    if files.len() != 1 {
        return Err("La conversion n’a pas produit exactement une piste.".into());
    }
    Ok(files)
}

#[cfg(test)]
#[path = "transfer_live_tests.rs"]
mod live_tests;
#[cfg(test)]
#[path = "transfer_job_tests.rs"]
mod tests;
