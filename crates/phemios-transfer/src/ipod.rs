//! Optional podkit adapter; only additive music sync is ever admitted.
use std::{
    fs,
    path::{Path, PathBuf},
};
fn program() -> Option<PathBuf> {
    let name = if cfg!(windows) {
        "podkit.exe"
    } else {
        "podkit"
    };
    let mut candidates: Vec<_> =
        std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default())
            .map(|dir| dir.join(name))
            .collect();
    if !cfg!(windows) {
        candidates.extend([
            PathBuf::from("/opt/homebrew/bin/podkit"),
            PathBuf::from("/usr/local/bin/podkit"),
        ]);
    }
    candidates
        .into_iter()
        .find(|path| path.is_absolute() && path.is_file())
}
/// Tool presence only; each actual invocation must still pass podkit's device validation.
pub fn podkit_available() -> bool {
    program().is_some()
}
/// Sync one staged selection without delete, reset, init, format, eject or forced upgrades.
/// Cancellation is deferred until this operation returns, preserving podkit's database transaction.
pub fn sync_ipod(
    mount: &crate::Mounted,
    source: &Path,
    work: &Path,
    quality: &str,
    valid: &dyn Fn() -> Result<(), String>,
) -> Result<(), String> {
    if !matches!(quality, "max" | "high" | "medium" | "low") {
        return Err("Qualité iPod invalide.".into());
    }
    let program =
        program().ok_or("Installez podkit pour transférer vers un iPod Apple compatible.")?;
    mount.confirm()?;
    let database = mount
        .path()
        .join("iPod_Control")
        .join("iTunes")
        .join("iTunesDB");
    let database_meta = fs::symlink_metadata(database)
        .map_err(|_| "Cet iPod doit déjà être initialisé avec une base iTunesDB compatible.")?;
    if !database_meta.is_file() || database_meta.file_type().is_symlink() {
        return Err("Base iPod indisponible ou non compatible.".into());
    }
    valid()?;
    let config = work.join("podkit.toml");
    // JSON strings are valid TOML basic strings for these admitted paths.
    let source = serde_json::to_string(&source.to_str().ok_or("Chemin iPod invalide.")?)
        .map_err(|_| "Chemin iPod invalide.")?;
    fs::write(
        &config,
        format!("version = 1\n[music.phemios]\npath = {source}\n"),
    )
    .map_err(|_| "Configuration iPod indisponible.")?;
    let args = vec![
        "--config".into(),
        config.to_string_lossy().into_owned(),
        "--no-color".into(),
        "--no-tips".into(),
        "--device".into(),
        mount.path().to_string_lossy().into_owned(),
        "sync".into(),
        "--type".into(),
        "music".into(),
        "--collection".into(),
        "phemios".into(),
        "--skip-upgrades".into(),
        "--audio-quality".into(),
        quality.into(),
    ];
    // Keep the common bounded stderr drain. The engine runner executes only this already selected tool.
    crate::process::run_engine(&program, &args, &|| {
        mount.confirm()?;
        valid()
    })
}
