//! Device-wide conservative admission: at most 1,000 attempted event requests in any 32 days.
use serde_json::{Value, json};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
const WINDOW: u64 = 32 * 86_400;
const LIMIT: usize = 1000;
const ERROR: &str = "Budget JamBase illisible ou occupé. Aucune recherche envoyée.";
pub(super) const EXHAUSTED: &str = "Plafond JamBase atteint. Aucune recherche envoyée.";
/// Cross-process lease is retained until the HTTP operation finishes, including quota preflight.
pub struct Budget {
    _lease: Lease,
    root: PathBuf,
    attempts: Vec<u64>,
    now: u64,
    remote: Option<Value>,
}
// Closing alone can retain a Unix lock through a duplicated/inherited descriptor.
// Construct only after successful acquisition, including before fallible journal reads.
struct Lease(File);
impl Lease {
    fn acquire(file: File) -> Result<Self, String> {
        file.try_lock().map_err(|_| ERROR)?;
        Ok(Self(file))
    }
}
impl Drop for Lease {
    fn drop(&mut self) {
        if self.0.unlock().is_err() {
            // Drop must not panic or disclose a credential, journal path or OS error text.
            let _ = writeln!(std::io::stderr().lock(), "JamBase budget unlock failed.");
        }
    }
}
fn admitted(path: &Path) -> Result<bool, String> {
    let meta = match fs::symlink_metadata(path) {
        Ok(meta) => meta,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(_) => return Err(ERROR.into()),
    };
    if !meta.is_file() || meta.len() > 64 * 1024 {
        return Err(ERROR.into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if meta.permissions().mode() & 0o077 != 0 {
            return Err(ERROR.into());
        }
    }
    Ok(true)
}
fn options() -> OpenOptions {
    let mut options = OpenOptions::new();
    options.write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options
}
impl Budget {
    /// Lock and read private retained attempts. Missing stores start empty; malformed ones fail closed.
    pub fn open(root: PathBuf) -> Result<Self, String> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| ERROR)?
            .as_secs();
        Self::at(root, now)
    }
    fn at(root: PathBuf, now: u64) -> Result<Self, String> {
        crate::private_storage::create_root(&root)?;
        let lock = root.join("jambase-budget.lock");
        admitted(&lock)?;
        let lease = options()
            .create(true)
            .truncate(false)
            .open(lock)
            .map_err(|_| ERROR)?;
        let lease = Lease::acquire(lease)?;
        Self::read_retained(root, now, lease)
    }
    fn read_retained(root: PathBuf, now: u64, lease: Lease) -> Result<Self, String> {
        let path = root.join("jambase-budget.json");
        let mut attempts = Vec::new();
        let mut remote = None;
        if admitted(&path)? {
            let mut bytes = Vec::new();
            File::open(path)
                .map_err(|_| ERROR)?
                .take(64 * 1024 + 1)
                .read_to_end(&mut bytes)
                .map_err(|_| ERROR)?;
            if bytes.len() > 64 * 1024 {
                return Err(ERROR.into());
            }
            let raw: Value = serde_json::from_slice(&bytes).map_err(|_| ERROR)?;
            let values = raw["attempts"].as_array().ok_or(ERROR)?;
            if raw["version"] != 1 || values.len() > LIMIT {
                return Err(ERROR.into());
            }
            for value in values {
                attempts.push(value.as_u64().ok_or(ERROR)?);
            }
            if attempts.windows(2).any(|w| w[0] > w[1])
                || attempts.last().is_some_and(|last| *last > now)
            {
                return Err(ERROR.into());
            }
            attempts.retain(|at| now.saturating_sub(*at) < WINDOW);
            if let Some(value) = raw.get("remote")
                && !value.is_null()
            {
                remote_period(value)?;
                let ceiling = retained_ceiling(value)?;
                if value["usedCalls"]
                    .as_u64()
                    .is_none_or(|used| used > ceiling)
                {
                    return Err(ERROR.into());
                }
                remote = Some(value.clone());
            }
        }
        Ok(Self {
            _lease: lease,
            root,
            attempts,
            now,
            remote,
        })
    }
    /// A public projection has no key, filesystem path or account identity.
    pub fn status(&self) -> Value {
        json!({"limit":LIMIT,"used":self.attempts.len(),"remaining":LIMIT-self.attempts.len(),"resetAt":self.attempts.first().map(|at|at+WINDOW)})
    }
    /// Include provider usage without trusting an eventually consistent counter to rise immediately.
    pub(super) fn reconcile(&mut self, quota: &Value) -> Result<(), String> {
        let period = remote_period(quota)?;
        let observed = quota["usedCalls"].as_u64().ok_or(ERROR)?;
        let previous = self
            .remote
            .as_ref()
            .filter(|value| remote_period(value).ok() == Some(period))
            .and_then(|value| value["usedCalls"].as_u64())
            .unwrap_or(0);
        let used = observed.max(previous);
        let ceiling = quota["quota"]
            .as_u64()
            .ok_or(ERROR)?
            .min(LIMIT as u64)
            .min(observed.saturating_add(quota["remainingCalls"].as_u64().ok_or(ERROR)?));
        if used >= ceiling {
            return Err(EXHAUSTED.into());
        }
        let added = usize::try_from(used.saturating_sub(previous)).map_err(|_| ERROR)?;
        if added >= LIMIT.saturating_sub(self.attempts.len()) {
            return Err(EXHAUSTED.into());
        }
        self.attempts.extend(std::iter::repeat_n(self.now, added));
        self.remote = Some(
            json!({"periodStart":period.0,"periodEnd":period.1,"usedCalls":used,"ceiling":ceiling}),
        );
        Ok(())
    }
    /// Persist the charge before sending; failures and ambiguous timeouts are never refunded.
    pub(super) fn reserve(&mut self) -> Result<(), String> {
        if self.attempts.len() >= LIMIT {
            return Err(EXHAUSTED.into());
        }
        let mut remote = self.remote.clone();
        if let Some(value) = &mut remote {
            let used = value["usedCalls"].as_u64().ok_or(ERROR)?;
            if used >= retained_ceiling(value)? {
                return Err(EXHAUSTED.into());
            }
            value["usedCalls"] = (used + 1).into();
        }
        let pending = self.root.join("jambase-budget.pending");
        let mut file = options()
            .create_new(true)
            .open(&pending)
            .map_err(|_| ERROR)?;
        let mut attempts = self.attempts.clone();
        attempts.push(self.now);
        let result: Result<(), String> = (|| {
            file.write_all(
                json!({"version":1,"attempts":attempts,"remote":remote})
                    .to_string()
                    .as_bytes(),
            )
            .map_err(|_| ERROR)?;
            file.sync_all().map_err(|_| ERROR)?;
            fs::rename(&pending, self.root.join("jambase-budget.json")).map_err(|_| ERROR)?;
            // Sync the containing directory on Unix so a crash cannot roll back a published charge.
            #[cfg(unix)]
            File::open(&self.root)
                .and_then(|f| f.sync_all())
                .map_err(|_| ERROR)?;
            Ok(())
        })();
        if result.is_err() {
            let _ = fs::remove_file(pending);
        }
        result?;
        self.attempts = attempts;
        self.remote = remote;
        Ok(())
    }
}
// Version-one ledgers written before effective-quota admission used the fixed 1,000 ceiling.
fn retained_ceiling(value: &Value) -> Result<u64, String> {
    match value.get("ceiling") {
        None => Ok(LIMIT as u64),
        Some(value) => value
            .as_u64()
            .filter(|ceiling| *ceiling <= LIMIT as u64)
            .ok_or_else(|| ERROR.into()),
    }
}

fn remote_period(value: &Value) -> Result<(&str, &str), String> {
    let field = |name| {
        value[name].as_str().filter(|text| {
            (20..=40).contains(&text.len())
                && text.is_ascii()
                && text.contains('T')
                && text.ends_with('Z')
        })
    };
    let start = field("periodStart").ok_or(ERROR)?;
    let end = field("periodEnd").ok_or(ERROR)?;
    if start >= end {
        return Err(ERROR.into());
    }
    Ok((start, end))
}
#[cfg(test)]
#[path = "concerts_budget_tests.rs"]
mod tests;
