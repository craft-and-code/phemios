//! Read-only mounted destinations; discovery never mounts, probes by writing, or copies files.
use serde_json::{Value, json};
use std::io::Read;
#[cfg(any(target_os = "macos", windows))]
use std::process::{Command, Stdio};
#[cfg(any(target_os = "macos", windows))]
use std::time::{Duration, Instant};
/// An OS mount candidate, not a certified music-player model or conversion profile.
#[derive(Debug, PartialEq, Eq)]
pub struct Volume {
    /// Display name derived from the mount path.
    pub name: String,
    /// OS-mounted absolute root.
    pub path: String,
    /// OS filesystem label.
    pub format: String,
    /// Mounted volume, removable drive or network share.
    pub kind: String,
}
impl Volume {
    /// Only public destination facts cross IPC.
    pub fn json(&self) -> Value {
        json!({"name":self.name,"path":self.path,"format":self.format,"kind":self.kind})
    }
}
fn volume(path: &str, format: &str, kind: &str) -> Volume {
    Volume {
        name: std::path::Path::new(path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(path)
            .to_owned(),
        path: path.into(),
        format: format.into(),
        kind: kind.into(),
    }
}
#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn unescape(path: &str) -> String {
    path.replace("\\040", " ")
        .replace("\\011", "\t")
        .replace("\\012", "\n")
        .replace("\\134", "\\")
}
#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn parse_mounts(text: &str, mac: bool) -> Vec<Volume> {
    let mut rows = Vec::new();
    for line in text.lines() {
        let parsed = if mac {
            line.split_once(" on ")
                .and_then(|(_, tail)| tail.rsplit_once(" ("))
                .map(|(path, flags)| {
                    (
                        path,
                        flags.split(',').next().unwrap_or("").trim_end_matches(')'),
                    )
                })
        } else {
            line.split_once(" - ").and_then(|(fields, tail)| {
                Some((
                    fields.split_whitespace().nth(4)?,
                    tail.split_whitespace().next()?,
                ))
            })
        };
        let Some((path, format)) = parsed else {
            continue;
        };
        let path = unescape(path);
        let network = matches!(
            format,
            "smbfs" | "cifs" | "nfs" | "nfs4" | "sshfs" | "fuse.sshfs"
        );
        let media = if mac {
            path.starts_with("/Volumes/")
        } else {
            ["/media/", "/run/media/", "/mnt/"]
                .iter()
                .any(|root| path.starts_with(root))
        };
        if path != "/"
            && path.starts_with('/')
            && (media || network)
            && !rows.iter().any(|row: &Volume| row.path == path)
        {
            rows.push(volume(
                &path,
                format,
                if network { "network" } else { "volume" },
            ));
        }
    }
    rows
}
#[cfg(any(target_os = "macos", test))]
fn external_from_info(plist: &str) -> Result<bool, String> {
    // This reads two typed keys emitted by diskutil, not arbitrary user-supplied XML.
    let internal = plist
        .split_once("<key>Internal</key>")
        .ok_or("Métadonnées des lecteurs invalides.")?
        .1
        .trim_start();
    if internal.starts_with("<true/>") {
        return Ok(false);
    }
    if !internal.starts_with("<false/>") {
        return Err("Métadonnées des lecteurs invalides.".into());
    }
    let protocol = plist
        .split_once("<key>BusProtocol</key>")
        .ok_or("Métadonnées des lecteurs invalides.")?
        .1
        .trim_start()
        .strip_prefix("<string>")
        .and_then(|tail| tail.split_once("</string>").map(|(value, _)| value))
        .ok_or("Métadonnées des lecteurs invalides.")?;
    if protocol.is_empty() || protocol.len() > 128 || protocol.contains(['<', '>']) {
        return Err("Métadonnées des lecteurs invalides.".into());
    }
    Ok(protocol != "Disk Image")
}
#[cfg(any(windows, test))]
fn parse_windows(bytes: &[u8]) -> Result<Vec<Volume>, String> {
    let rows: Vec<Value> =
        serde_json::from_slice(bytes).map_err(|_| "Détection des lecteurs illisible.")?;
    rows.into_iter()
        .map(|row| {
            let path = row["path"].as_str().ok_or("Lecteur invalide.")?;
            let format = row["format"].as_str().ok_or("Lecteur invalide.")?;
            let kind = row["kind"].as_str().ok_or("Lecteur invalide.")?;
            if path.len() != 3
                || !path.as_bytes()[0].is_ascii_alphabetic()
                || &path[1..] != ":\\"
                || !matches!(kind, "removable" | "network" | "volume")
            {
                return Err("Lecteur invalide.".into());
            }
            Ok(volume(path, format, kind))
        })
        .collect()
}
#[cfg(any(target_os = "macos", windows))]
fn output(program: &str, args: &[&str], timeout: Duration) -> Result<Vec<u8>, String> {
    let mut child = Command::new(program)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "Détection des lecteurs indisponible.")?;
    let stdout = child
        .stdout
        .take()
        .ok_or("Détection des lecteurs indisponible.")?;
    let reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        stdout.take(262145).read_to_end(&mut bytes).map(|_| bytes)
    });
    let deadline = Instant::now() + timeout;
    let status = loop {
        if let Some(status) = child
            .try_wait()
            .map_err(|_| "Détection des lecteurs indisponible.")?
        {
            break status;
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err("La détection des lecteurs a expiré.".into());
        }
        std::thread::sleep(Duration::from_millis(10));
    };
    let bytes = reader
        .join()
        .map_err(|_| "Détection des lecteurs interrompue.")?
        .map_err(|_| "Détection des lecteurs illisible.")?;
    if !status.success() || bytes.len() > 262144 {
        return Err("Détection des lecteurs illisible.".into());
    }
    Ok(bytes)
}
/// Discover current mounted candidates through fixed OS commands, with no client-supplied paths or arguments.
pub fn discover() -> Result<Vec<Volume>, String> {
    #[cfg(target_os = "macos")]
    {
        let deadline = Instant::now() + Duration::from_secs(3);
        let bytes = output("/sbin/mount", &[], Duration::from_secs(3))?;
        let candidates = parse_mounts(
            std::str::from_utf8(&bytes).map_err(|_| "Détection des lecteurs illisible.")?,
            true,
        );
        let mut rows = Vec::new();
        for row in candidates {
            if row.kind == "network" {
                rows.push(row);
                continue;
            }
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err("La détection des lecteurs a expiré.".into());
            }
            let info = output(
                "/usr/sbin/diskutil",
                &["info", "-plist", &row.path],
                remaining,
            )?;
            if external_from_info(
                std::str::from_utf8(&info).map_err(|_| "Métadonnées des lecteurs invalides.")?,
            )? {
                rows.push(row);
            }
        }
        Ok(rows)
    }
    #[cfg(target_os = "linux")]
    {
        let file = std::fs::File::open("/proc/self/mountinfo")
            .map_err(|_| "Détection des lecteurs indisponible.")?;
        let mut text = String::new();
        file.take(262145)
            .read_to_string(&mut text)
            .map_err(|_| "Détection des lecteurs illisible.")?;
        if text.len() > 262144 {
            return Err("Détection des lecteurs illisible.".into());
        }
        Ok(parse_mounts(&text, false))
    }
    #[cfg(windows)]
    {
        let bytes = output(
            "powershell.exe",
            &[
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -in 2,4 -or ($_.DriveType -eq 3 -and $_.DeviceID -ne $env:SystemDrive) } | ForEach-Object { @{ path=($_.DeviceID+'\\'); kind=$(if($_.DriveType -eq 4){'network'}elseif($_.DriveType -eq 2){'removable'}else{'volume'}); format=[string]$_.FileSystem } })",
            ],
            Duration::from_secs(3),
        )?;
        parse_windows(&bytes)
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
    {
        Err("Détection des lecteurs indisponible sur cette plateforme.".into())
    }
}
#[cfg(test)]
#[path = "volumes_tests.rs"]
mod tests;
