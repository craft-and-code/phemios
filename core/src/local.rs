//! Owned Aède child and protected desktop configuration; no arbitrary executable API.
use serde_json::{Value, json};
use std::{
    fs,
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    time::Duration,
};
#[path = "local_mounts.rs"]
mod mounts;
#[path = "local_tls.rs"]
mod tls;
/// App-owned local engine. Keeping its stdin open leases the server's lifetime.
pub struct Engine {
    root: PathBuf,
    executable: PathBuf,
    child: Option<Child>,
    lease: Option<ChildStdin>,
    address: Option<String>,
    certificate: Option<Vec<u8>>,
}
impl Engine {
    /// Construct a manager for a fixed bundled executable and isolated app data.
    /// Unix roots reject shared write access; Windows retains inherited ACLs.
    /// Metadata admission does not provide race-proof filesystem confinement.
    pub fn new(root: PathBuf, executable: PathBuf) -> Self {
        Self {
            root,
            executable,
            child: None,
            lease: None,
            address: None,
            certificate: None,
        }
    }
    /// Fixed bundled engine for read-only staging scans and explicit destination copies.
    pub fn copy_executable(&self) -> PathBuf {
        self.executable.clone()
    }
    fn file(&self) -> PathBuf {
        self.root.join("desktop.json")
    }
    // Admit the root itself before private reads/publication. This metadata
    // check does not provide race-proof confinement of ancestor directories.
    fn validate_root(&self) -> Result<(), String> {
        crate::private_storage::validate_root(&self.root)
    }
    fn config(&self) -> Result<Value, String> {
        self.validate_root()?;
        let path = self.file();
        let meta = match fs::symlink_metadata(&path) {
            Ok(meta) => meta,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(json!({"version":1,"enabled":false,"roots":[],"keys":{}}));
            }
            Err(_) => return Err("Configuration locale illisible.".into()),
        };
        if !meta.is_file() || meta.len() > 128 * 1024 {
            return Err("Configuration locale invalide.".into());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if meta.permissions().mode() & 0o077 != 0 {
                return Err(
                    "Les permissions de la configuration locale ne protègent pas ses secrets."
                        .into(),
                );
            }
        }
        // Bound the actual read too: the file can grow after metadata inspection.
        let mut bytes = Vec::new();
        fs::File::open(path)
            .map_err(|_| "Configuration locale illisible.")?
            .take(128 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "Configuration locale illisible.")?;
        if bytes.len() > 128 * 1024 {
            return Err("Configuration locale invalide.".into());
        }
        let value: Value =
            serde_json::from_slice(&bytes).map_err(|_| "Configuration locale corrompue.")?;
        if value["version"] != 1 || !value["roots"].is_array() || !value["keys"].is_object() {
            return Err("Configuration locale incompatible.".into());
        }
        Ok(value)
    }
    fn save(&self, value: &Value) -> Result<(), String> {
        crate::private_storage::create_root(&self.root)?;
        let tmp = self.root.join("desktop.pending");
        let mut options = fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&tmp)
            .map_err(|_| "Configuration locale occupée.")?;
        let work = (|| {
            file.write_all(value.to_string().as_bytes())
                .map_err(|_| "Écriture locale impossible.")?;
            file.sync_all().map_err(|_| "Écriture locale impossible.")?;
            fs::rename(&tmp, self.file()).map_err(|_| "Publication locale impossible.")?;
            Ok(())
        })();
        if work.is_err() {
            let _ = fs::remove_file(tmp);
        }
        work
    }
    /// Public configuration never returns credentials or service keys.
    pub fn status(&mut self) -> Result<Value, String> {
        let value = self.config()?;
        let running = match &mut self.child {
            Some(child) => child
                .try_wait()
                .map_err(|_| "État du moteur indisponible.")?
                .is_none(),
            None => false,
        };
        let roots = value["roots"]
            .as_array()
            .ok_or("Dossiers invalides.")?
            .iter()
            .map(|row| {
                let path = row["path"].as_str().unwrap_or("");
                let available = mounts::available(row);
                json!({"path":path,"available":available,"mount":row["mount"]})
            })
            .collect::<Vec<_>>();
        Ok(
            json!({"enabled":value["enabled"],"running":running,"roots":roots,"keys":{"fanart":value["keys"]["fanart"].as_str().is_some(),"acoustid":value["keys"]["acoustid"].as_str().is_some()}}),
        )
    }
    /// Start or reuse only this process's child, authenticating with a retained generated secret.
    pub fn start(&mut self) -> Result<crate::network::Client, String> {
        let mut value = self.config()?;
        if value["password"].is_null() {
            let mut bytes = [0; 32];
            getrandom::fill(&mut bytes).map_err(|_| "Générateur sécurisé indisponible.")?;
            value["password"] = Value::String(bytes.iter().map(|b| format!("{b:02x}")).collect());
        }
        value["enabled"] = Value::Bool(true);
        self.save(&value)?;
        let password = value["password"]
            .as_str()
            .filter(|s| s.len() == 64)
            .ok_or("Secret local invalide.")?;
        if self
            .child
            .as_mut()
            .is_some_and(|child| child.try_wait().ok() == Some(None))
        {
            return crate::network::Client::login_pinned(
                self.address.as_deref().ok_or("Adresse locale absente.")?,
                "phemios-local",
                password,
                self.certificate
                    .as_deref()
                    .ok_or("Identité TLS locale absente.")?,
            );
        }
        self.stop_process();
        let identity = tls::Identity::generate()?;
        let mut command = self.command();
        command
            .args(["serve", "--port=0"])
            .env("AEDE_DESKTOP_LEASE", "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped());
        command
            .env_remove("AEDE_FANARTTV_KEY")
            .env_remove("AEDE_ACOUSTID_KEY");
        let mut child = command
            .spawn()
            .map_err(|_| "Le moteur Aède embarqué ne peut pas démarrer.")?;
        let mut stdin = child.stdin.take().ok_or("Entrée du moteur indisponible.")?;
        writeln!(stdin, "{}", identity.bootstrap("phemios-local", password))
            .map_err(|_| "Initialisation du moteur impossible.")?;
        let stdout = child
            .stdout
            .take()
            .ok_or("Sortie du moteur indisponible.")?;
        let (tx, rx) = std::sync::mpsc::sync_channel(1);
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            let mut line = String::new();
            let result = std::io::Read::take(&mut reader, 2049)
                .read_line(&mut line)
                .map(|_| line);
            let _ = tx.send(result);
            let _ = std::io::copy(&mut reader, &mut std::io::sink());
        });
        let ready = rx
            .recv_timeout(Duration::from_secs(12))
            .ok()
            .and_then(Result::ok)
            .and_then(|line| serde_json::from_str::<Value>(&line).ok());
        let address = ready.as_ref().and_then(tls::address);
        let Some(address) = address else {
            drop(stdin);
            let _ = child.kill();
            let _ = child.wait();
            return Err("Aède n’a pas confirmé son démarrage local.".into());
        };
        self.address = Some(address.clone());
        self.certificate = Some(identity.certificate_der.clone());
        self.child = Some(child);
        self.lease = Some(stdin);
        crate::network::Client::login_pinned(
            &address,
            "phemios-local",
            password,
            &identity.certificate_der,
        )
    }
    fn command(&self) -> Command {
        let mut command = Command::new(&self.executable);
        command
            .arg(format!("--data={}", self.root.join("engine").display()))
            .env_remove("AEDE_ADMIN_TOKEN")
            .env_remove("AEDE_DESKTOP_LEASE")
            .env_remove("AEDE_FANARTTV_KEY")
            .env_remove("AEDE_ACOUSTID_KEY")
            .env_remove("AEDE_DELEGATED_CHILD")
            .env_remove("AEDE_DELEGATED_DATA_DIR")
            .env_remove("AEDE_UNAVAILABLE_ROOTS")
            .env("NO_COLOR", "1")
            .stderr(Stdio::null());
        command
    }
    fn stop_process(&mut self) {
        self.lease.take();
        self.address.take();
        self.certificate.take();
        if let Some(mut child) = self.child.take() {
            std::thread::spawn(move || {
                let _ = child.wait();
            });
        }
    }
    /// Disable future startup; catalog, annotations and source files are retained.
    pub fn stop(&mut self) -> Result<(), String> {
        let mut value = self.config()?;
        value["enabled"] = Value::Bool(false);
        self.save(&value)?;
        self.stop_process();
        Ok(())
    }
    /// Register folders picked by the native dialog; scanning remains an explicit action.
    pub fn add_roots(&self, paths: &[PathBuf]) -> Result<(), String> {
        let mut value = self.config()?;
        let roots = value["roots"].as_array_mut().ok_or("Dossiers invalides.")?;
        for path in paths {
            let path = path
                .to_str()
                .ok_or("Le chemin du dossier doit être UTF-8.")?;
            if !Path::new(path).is_absolute() || path.len() > 4096 || roots.len() >= 64 {
                return Err("Dossier local invalide ou limite de 64 dossiers atteinte.".into());
            }
            if !roots.iter().any(|row| row["path"] == path) {
                roots.push(json!({"path":path,"mount":mounts::mount_for(Path::new(path))}));
            }
        }
        self.save(&value)
    }
    /// Build an explicit scan request, preserving known unmounted roots.
    pub fn scan_request(&self, full: bool, threads: u64) -> Result<Value, String> {
        if threads > 64 {
            return Err("Nombre de threads invalide.".into());
        }
        let value = self.config()?;
        let roots = value["roots"].as_array().ok_or("Dossiers invalides.")?;
        Ok(
            json!({"folders":roots.iter().map(|v|v["path"].clone()).collect::<Vec<_>>(),"unavailable_folders":roots.iter().filter(|v|!mounts::available(v)).map(|v|v["path"].clone()).collect::<Vec<_>>(),"full":full,"threads":threads}),
        )
    }
    /// Record accepted scan registration without pretending the task has completed.
    pub fn accepted_scan(&self) -> Result<(), String> {
        let mut value = self.config()?;
        for row in value["roots"].as_array_mut().ok_or("Dossiers invalides.")? {
            row["registered"] = Value::Bool(true);
        }
        self.save(&value)
    }
    /// Explicit watched-root/exclusion changes reuse the bundled engine's CLI rules.
    pub fn root_action(&self, path: &str, action: &str) -> Result<(), String> {
        if !Path::new(path).is_absolute() || path.contains('\0') || path.len() > 4096 {
            return Err("Dossier invalide.".into());
        }
        if action == "remove" {
            let mut config = self.config()?;
            let registered = config["roots"]
                .as_array()
                .ok_or("Dossiers invalides.")?
                .iter()
                .any(|row| row["path"] == path && row["registered"] == true);
            if !registered {
                config["roots"]
                    .as_array_mut()
                    .ok_or("Dossiers invalides.")?
                    .retain(|row| row["path"] != path);
                return self.save(&config);
            }
        }
        let mut command = self.command();
        command.args(["roots", "--no-scan"]);
        match action {
            "remove" => {
                command.args(["--remove", path]);
            }
            "exclude" => {
                command.args(["--exclude", path]);
            }
            "include" => {
                command.args(["--exclude", path, "--remove"]);
            }
            _ => return Err("Action dossier invalide.".into()),
        };
        let result = command
            .stdout(Stdio::null())
            .status()
            .map_err(|_| "Modification des dossiers impossible.")?;
        if !result.success() {
            return Err(
                "Aède a refusé la modification des dossiers (données occupées ou chemin invalide)."
                    .into(),
            );
        }
        if action == "remove" {
            let mut value = self.config()?;
            value["roots"]
                .as_array_mut()
                .ok_or("Dossiers invalides.")?
                .retain(|row| row["path"] != path);
            self.save(&value)?;
        }
        Ok(())
    }
    /// Lock budget admission before changing a key: an occupied request cannot produce a false failed save.
    /// This local-only status projection never returns credentials or contacts the provider.
    pub fn configure_concerts(&self, key: Option<&str>, remove: bool) -> Result<Value, String> {
        let budget = self.concert_budget()?;
        if let Some(key) = key {
            self.set_concert_key(key, remove)?;
        } else if remove {
            self.set_concert_key("", true)?;
        }
        let ready = self.concert_key()?.is_some();
        let mut status = budget.status();
        status["ready"] = ready.into();
        Ok(status)
    }
    /// Read the private concert-provider key only inside native Rust operations.
    pub fn concert_key(&self) -> Result<Option<String>, String> {
        let value = self.config()?;
        match value.get("jambase") {
            None | Some(Value::Null) => Ok(None),
            Some(Value::String(key)) => {
                crate::concerts::validate_key(key)?;
                Ok(Some(key.clone()))
            }
            _ => Err("Configuration JamBase illisible.".into()),
        }
    }
    /// Publish or explicitly remove the concert key without starting an engine or exposing it.
    fn set_concert_key(&self, key: &str, remove: bool) -> Result<(), String> {
        if !remove {
            self.concert_key()?;
        }
        let mut value = self.config()?;
        if remove {
            value
                .as_object_mut()
                .ok_or("Configuration locale invalide.")?
                .remove("jambase");
        } else {
            crate::concerts::validate_key(key.trim())?;
            value["jambase"] = key.trim().into();
        }
        value
            .as_object_mut()
            .ok_or("Configuration locale invalide.")?
            .remove("ticketmaster");
        self.save(&value)
    }
    /// Lock the device-wide provider budget independently of the active Aède account.
    pub fn concert_budget(&self) -> Result<crate::concerts::Budget, String> {
        crate::concerts::Budget::open(self.root.clone())
    }
    /// Retained service keys are private Rust data, attached only to explicit fetch requests.
    pub fn fetch_keys(&self) -> Result<Value, String> {
        Ok(self.config()?["keys"].clone())
    }
    /// Save explicitly supplied external keys; empty input preserves, removal is explicit.
    pub fn keys(
        &mut self,
        fanart: &str,
        acoustid: &str,
        remove_fanart: bool,
        remove_acoustid: bool,
    ) -> Result<(), String> {
        let mut value = self.config()?;
        for (key, text, remove) in [
            ("fanart", fanart, remove_fanart),
            ("acoustid", acoustid, remove_acoustid),
        ] {
            if text.len() > 1024 || text.chars().any(char::is_control) {
                return Err("Clé API invalide.".into());
            }
            if remove {
                value["keys"]
                    .as_object_mut()
                    .ok_or("Clés invalides.")?
                    .remove(key);
            } else if !text.trim().is_empty() {
                value["keys"][key] = text.trim().into();
            }
        }
        self.save(&value)?;
        Ok(())
    }
}
impl Drop for Engine {
    fn drop(&mut self) {
        self.stop_process();
    }
}
#[cfg(test)]
#[path = "local_tests.rs"]
mod tests;
