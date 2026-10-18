//! Explicit developer probe: public profile path plus password on stdin, never command arguments.
use std::{io::Read, path::PathBuf};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .ok_or("Provide the public server profile path")?;
    let mut text = String::new();
    std::fs::File::open(path)?
        .take(32769)
        .read_to_string(&mut text)?;
    let profile = phemios_core::server_profile::parse(&text)?;
    let mut password = String::new();
    std::io::stdin().take(1025).read_to_string(&mut password)?;
    let certificate = profile["certificate"]
        .as_array()
        .ok_or("Certificate is absent")?
        .iter()
        .map(|v| {
            v.as_u64()
                .and_then(|n| u8::try_from(n).ok())
                .ok_or("Certificate is invalid")
        })
        .collect::<Result<Vec<_>, _>>()?;
    let client = phemios_core::network::Client::login_pinned(
        profile["address"].as_str().ok_or("Address is absent")?,
        profile["username"].as_str().ok_or("Username is absent")?,
        &password,
        &certificate,
    )?;
    client.request("GET", "/api/v1/status", &[], None)?;
    println!(
        "{}",
        serde_json::json!({"authenticated":true,"server":profile["address"]})
    );
    client.request("DELETE", "/api/auth/v1/session", &[], None)?;
    Ok(())
}
