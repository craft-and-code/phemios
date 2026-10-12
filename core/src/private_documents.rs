//! Shared bounded private document IO; trusted native Client identity owns every object.
use crate::{federation::Source, network::Client, private_storage};
use serde_json::{Value, json};
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::PathBuf;
pub(crate) enum Kind {
    Podcasts,
    Articles,
}
impl Kind {
    fn name(&self) -> &'static str {
        match self {
            Self::Podcasts => "podcasts",
            Self::Articles => "articles",
        }
    }
    fn limit(&self) -> usize {
        match self {
            Self::Podcasts => 8 * 1024 * 1024 + 4096,
            Self::Articles => 3 * 1024 * 1024 + 4096,
        }
    }
}
pub(crate) fn owner(source: Source, client: &Client) -> Result<Value, String> {
    let account = client.account();
    let id = account["account"]["id"]
        .as_str()
        .filter(|id| !id.is_empty() && id.len() <= 256)
        .ok_or("Compte privé invalide.")?;
    let authority = if source == Source::Local {
        "phemios-managed-local"
    } else {
        account["server"].as_str().ok_or("Compte privé invalide.")?
    };
    Ok(json!([source.name(), authority, id]))
}
pub(crate) struct Store {
    root: PathBuf,
    kind: Kind,
}
impl Store {
    pub(crate) fn new(root: PathBuf, kind: Kind) -> Self {
        Self { root, kind }
    }
    pub(crate) fn path(&self, owner: &Value) -> PathBuf {
        // Stable FNV selectors are not an authorization boundary. Exact owner/namespace
        // checks refuse any colliding object before both reads and replacement writes.
        let digest = |domain: &str| {
            domain
                .bytes()
                .chain(owner.to_string().bytes())
                .fold(0xcbf29ce484222325_u64, |hash, byte| {
                    (hash ^ u64::from(byte)).wrapping_mul(0x100000001b3)
                })
        };
        self.root.join(format!(
            "{}-{:016x}{:016x}.json",
            self.kind.name(),
            digest("private:1"),
            digest("private:2")
        ))
    }
    pub(crate) fn read(&self, owner: &Value) -> Result<Option<Value>, String> {
        private_storage::validate_root(&self.root)?;
        let path = self.path(owner);
        let metadata = match fs::symlink_metadata(&path) {
            Ok(meta) => meta,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(_) => return Err("Données privées illisibles.".into()),
        };
        if !metadata.is_file() || metadata.len() > self.kind.limit() as u64 {
            return Err("Données privées illisibles.".into());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if metadata.permissions().mode() & 0o077 != 0 {
                return Err("Permissions des données privées invalides.".into());
            }
        }
        let mut bytes = Vec::new();
        fs::File::open(&path)
            .map_err(|_| "Données privées illisibles.")?
            .take(self.kind.limit() as u64 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "Données privées illisibles.")?;
        if bytes.len() > self.kind.limit() {
            return Err("Limite de stockage privé atteinte.".into());
        }
        let value: Value =
            serde_json::from_slice(&bytes).map_err(|_| "Données privées illisibles.")?;
        if value["version"] != 1
            || value["owner"] != *owner
            || value["namespace"] != self.kind.name()
        {
            return Err("Données privées illisibles.".into());
        }
        Ok(Some(value))
    }
    fn encoded(&self, owner: &Value, mut value: Value) -> Result<Vec<u8>, String> {
        let fields = value.as_object_mut().ok_or("Données privées illisibles.")?;
        fields.insert("version".into(), 1.into());
        fields.insert("owner".into(), owner.clone());
        fields.insert("namespace".into(), self.kind.name().into());
        let bytes = serde_json::to_vec(&value).map_err(|_| "Données privées illisibles.")?;
        if bytes.len() > self.kind.limit() {
            return Err("Limite de stockage privé atteinte.".into());
        }
        Ok(bytes)
    }
    /// Preflight the exact retained wrapper budget, including unknown document extensions.
    pub(crate) fn preflight(&self, owner: &Value, value: &Value) -> Result<(), String> {
        self.encoded(owner, value.clone()).map(|_| ())
    }
    pub(crate) fn write(&self, owner: &Value, value: Value) -> Result<(), String> {
        self.read(owner)?;
        let bytes = self.encoded(owner, value)?;
        private_storage::create_root(&self.root)?;
        let path = self.path(owner);
        let pending = path.with_extension("pending");
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&pending)
            .map_err(|_| "Données privées occupées.")?;
        let result: Result<(), String> = (|| {
            file.write_all(&bytes)
                .map_err(|_| "Écriture privée impossible.")?;
            file.sync_all().map_err(|_| "Écriture privée impossible.")?;
            private_storage::validate_root(&self.root)?;
            fs::rename(&pending, &path).map_err(|_| "Publication privée impossible.".to_owned())
        })();
        if result.is_err() {
            let _ = fs::remove_file(pending);
        }
        result
    }
}
