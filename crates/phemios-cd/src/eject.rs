//! Only fixed system ejection commands and a natively discovered optical path are admitted.
use std::{
    process::{Command, Stdio},
    time::{Duration, Instant},
};
pub(super) fn run(path: &str) -> Result<(), String> {
    let mut command = command(path)?;
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "La commande système d’éjection est indisponible.")?;
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                return if status.success() {
                    Ok(())
                } else {
                    Err("Le système a refusé l’éjection du CD.".into())
                };
            }
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(10)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("L’éjection du CD n’a pas été confirmée.".into());
            }
        }
    }
}
#[cfg(target_os = "macos")]
fn command(path: &str) -> Result<Command, String> {
    let number = path.strip_prefix("disk").ok_or("Lecteur CD invalide.")?;
    if number.is_empty() || !number.bytes().all(|b| b.is_ascii_digit()) {
        return Err("Lecteur CD invalide.".into());
    }
    let mut c = Command::new("/usr/sbin/diskutil");
    c.args(["eject", &format!("/dev/{path}")]);
    Ok(c)
}
#[cfg(target_os = "linux")]
fn command(path: &str) -> Result<Command, String> {
    let number = path.strip_prefix("/dev/sr").ok_or("Lecteur CD invalide.")?;
    if number.is_empty() || !number.bytes().all(|b| b.is_ascii_digit()) {
        return Err("Lecteur CD invalide.".into());
    }
    let mut c = Command::new("/usr/bin/eject");
    c.args(["--", path]);
    Ok(c)
}
#[cfg(target_os = "windows")]
fn command(path: &str) -> Result<Command, String> {
    use std::os::windows::process::CommandExt;
    let letter = path
        .strip_prefix(r"\\.\")
        .and_then(|p| p.strip_suffix(':'))
        .ok_or("Lecteur CD invalide.")?;
    if letter.len() != 1 || !letter.bytes().all(|b| b.is_ascii_uppercase()) {
        return Err("Lecteur CD invalide.".into());
    }
    let system = std::env::var_os("SystemRoot").ok_or("Répertoire système indisponible.")?;
    let mut c = Command::new(
        std::path::Path::new(&system).join("System32/WindowsPowerShell/v1.0/powershell.exe"),
    );
    c.creation_flags(0x08000000)
        .env("PHEMIOS_CD_DRIVE", format!("{letter}:"));
    c.args(["-NoProfile","-NonInteractive","-Command", "$ErrorActionPreference='Stop'; $d=(New-Object -ComObject Shell.Application).Namespace(17).ParseName($env:PHEMIOS_CD_DRIVE); if ($null -eq $d) { exit 1 }; $d.InvokeVerb('Eject')"]);
    Ok(c)
}
#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn command(_path: &str) -> Result<Command, String> {
    Err("Éjection du CD indisponible sur ce système.".into())
}
#[cfg(test)]
#[path = "eject_tests.rs"]
mod tests;
