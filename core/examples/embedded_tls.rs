//! Explicit host acceptance against a separately built Aède binary and disposable data.
use phemios_core::local::Engine;
use serde_json::Value;
use std::{
    path::PathBuf,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let binary = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .ok_or("supply the built Aède executable")?;
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    let root = std::env::temp_dir().join(format!(
        "phemios-embedded-tls-{}-{nonce}",
        std::process::id()
    ));
    let mut engine = Engine::new(root.clone(), binary);
    let client = engine.start()?;
    let account = client.account();
    assert!(
        account["server"]
            .as_str()
            .is_some_and(|address| address.starts_with("https://127.0.0.1:"))
    );
    let status = client.request("GET", "/api/v1/status", &[], None)?;
    assert_eq!(status["status"], "ok");
    let accounts = client.request("GET", "/api/admin/v1/accounts", &[], None)?;
    assert_eq!(accounts.as_array().map(Vec::len), Some(1));
    let again = engine.start()?;
    assert_eq!(again.account()["server"], account["server"]);
    assert_eq!(
        again.request("GET", "/api/v1/status", &[], None)?["status"],
        "ok"
    );
    engine.stop()?;
    let address = account["server"]
        .as_str()
        .ok_or("missing address")?
        .trim_start_matches("https://");
    let mut stopped = false;
    for _ in 0..100 {
        if std::net::TcpStream::connect(address).is_err() {
            stopped = true;
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    assert!(
        stopped,
        "owned engine must stop after its lifetime lease closes"
    );
    drop(engine);
    let saved: Value = serde_json::from_slice(&std::fs::read(root.join("desktop.json"))?)?;
    assert!(saved.get("tls").is_none());
    assert!(saved.get("certificate").is_none());
    std::fs::remove_dir_all(root)?;
    println!("Embedded HTTPS startup, verified administrator requests, reuse and shutdown passed.");
    Ok(())
}
