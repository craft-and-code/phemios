//! Fixed engine invocation with continuously drained, bounded diagnostics.
use std::{
    io::Read,
    path::Path,
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    time::Duration,
};
/// Run one engine operation. Cancellation is between files so temporary outputs can be cleaned normally.
/// The caller owns all arguments; no shell or user-selected executable is involved.
pub fn run_engine(
    executable: &Path,
    args: &[String],
    valid: &dyn Fn() -> Result<(), String>,
) -> Result<(), String> {
    valid()?;
    let mut command = if cfg!(unix) && Path::new("/usr/bin/nice").is_file() {
        let mut command = Command::new("/usr/bin/nice");
        command.args(["-n", "10"]).arg(executable);
        command
    } else {
        Command::new(executable)
    };
    // A user's unrelated podkit environment must not broaden this explicit additive selection.
    for (key, _) in std::env::vars_os() {
        if key
            .to_str()
            .is_some_and(|value| value.to_ascii_uppercase().starts_with("PODKIT_"))
        {
            command.env_remove(key);
        }
    }
    let mut child = command
        .args(args)
        .env("NO_COLOR", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "Moteur de copie Aède indisponible.")?;
    let stderr = child.stderr.take().ok_or("Diagnostic Aède indisponible.")?;
    let tail = Arc::new(Mutex::new(Vec::new()));
    let output = tail.clone();
    let drain = std::thread::spawn(move || {
        let mut stderr = stderr;
        let mut chunk = [0; 4096];
        while let Ok(n) = stderr.read(&mut chunk) {
            if n == 0 {
                break;
            }
            if let Ok(mut bytes) = output.lock() {
                bytes.extend_from_slice(&chunk[..n]);
                let excess = bytes.len().saturating_sub(8192);
                bytes.drain(..excess);
            }
        }
    });
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) => std::thread::sleep(Duration::from_millis(40)),
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                break Err("Processus Aède interrompu.");
            }
        }
    };
    drain.join().map_err(|_| "Diagnostic Aède interrompu.")?;
    let status = status.map_err(str::to_owned)?;
    if !status.success() {
        let bytes = tail.lock().map_err(|_| "Diagnostic Aède indisponible.")?;
        let message = String::from_utf8_lossy(&bytes);
        return Err(if message.trim().is_empty() {
            "La copie Aède a échoué.".into()
        } else {
            message.trim().to_owned()
        });
    }
    valid()
}
