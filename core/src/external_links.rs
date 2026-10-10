//! Narrow system-browser handoff for explicit HTTPS source links; never a shell or filesystem opener.
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
/// Accept bounded HTTPS URLs without credentials, whitespace, backslashes or nonstandard ports.
pub fn browser_url(value: &str) -> Result<&str, String> {
    if value.len() > 4096
        || value.chars().any(|c| c.is_control() || c.is_whitespace())
        || value.contains('\\')
    {
        return Err("Lien externe invalide.".into());
    }
    let address = value.split('#').next().ok_or("Lien externe invalide.")?;
    let uri: ureq::http::Uri = address.parse().map_err(|_| "Lien externe invalide.")?;
    if !uri
        .scheme_str()
        .is_some_and(|s| s.eq_ignore_ascii_case("https"))
        || uri.authority().is_none_or(|a| a.as_str().contains('@'))
        || uri.host().is_none_or(str::is_empty)
        || !matches!(uri.port_u16(), None | Some(443))
    {
        return Err("Seuls les liens HTTPS sans identifiants peuvent être ouverts.".into());
    }
    Ok(value)
}
fn browser_command(url: &str) -> Result<Command, String> {
    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("/usr/bin/open");
        command.arg("--").arg(url);
        Ok(command)
    }
    #[cfg(target_os = "linux")]
    {
        let mut command = Command::new("/usr/bin/xdg-open");
        command.arg(url);
        Ok(command)
    }
    #[cfg(target_os = "windows")]
    {
        let system = std::env::var_os("SystemRoot").ok_or("Navigateur système indisponible.")?;
        let mut command =
            Command::new(std::path::PathBuf::from(system).join("System32/rundll32.exe"));
        command.arg("url.dll,FileProtocolHandler").arg(url);
        Ok(command)
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let _ = url;
        Err("Navigateur système indisponible.".into())
    }
}
/// Dispatch a user-activated source URL with fixed OS helpers and separate argv, never command interpretation.
/// A long-running browser handler is reaped independently; success means OS handoff, not verified page load.
pub fn open_browser(url: &str) -> Result<(), String> {
    let mut command = browser_command(browser_url(url)?)?;
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "Impossible d’ouvrir le navigateur système.")?;
    let deadline = Instant::now() + Duration::from_millis(500);
    loop {
        if let Some(status) = child
            .try_wait()
            .map_err(|_| "Impossible d’ouvrir le navigateur système.")?
        {
            return if status.success() {
                Ok(())
            } else {
                Err("Impossible d’ouvrir le navigateur système.".into())
            };
        }
        if Instant::now() >= deadline {
            std::thread::spawn(move || {
                let _ = child.wait();
            });
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(10));
    }
}
#[cfg(test)]
#[path = "external_links_tests.rs"]
mod tests;
