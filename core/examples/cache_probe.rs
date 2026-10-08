//! Count readable artwork in a public cache without exposing library identities.
use phemios_core::{cache::Cache, network::Client};
use std::io::Read;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = std::env::args_os()
        .nth(1)
        .ok_or("cache directory required")?;
    let cache = Cache::new(root.into());
    let snapshot = cache.load()?.ok_or("cache missing")?;
    let client = if std::env::args_os().nth(2).is_some() {
        let mut input = String::new();
        std::io::stdin().take(8192).read_to_string(&mut input)?;
        let value: serde_json::Value = serde_json::from_str(&input)?;
        Some(Client::login(
            value["server"].as_str().ok_or("server missing")?,
            value["username"].as_str().ok_or("username missing")?,
            value["password"].as_str().ok_or("password missing")?,
        )?)
    } else {
        None
    };
    let mut expected = 0;
    let mut hits = 0;
    for album in snapshot["albums"].as_array().ok_or("albums missing")? {
        if album["cover"] == true {
            expected += 1;
            if cache
                .image(
                    &snapshot,
                    album["reference"].as_str().ok_or("ref missing")?,
                    "cover",
                )?
                .is_some()
            {
                hits += 1;
            } else if let Some(client) = &client {
                match client.artwork(album["reference"].as_str().ok_or("ref missing")?, "cover") {
                    Ok(bytes) => println!("Uncached cover fetched: {} bytes", bytes.len()),
                    Err(error) => println!("Uncached cover: {error}"),
                }
            }
        }
    }
    for artist in snapshot["artists"].as_array().ok_or("artists missing")? {
        for kind in ["portrait", "banner", "background"] {
            if artist["media"][kind] == true {
                expected += 1;
                if cache
                    .image(
                        &snapshot,
                        artist["reference"].as_str().ok_or("ref missing")?,
                        kind,
                    )?
                    .is_some()
                {
                    hits += 1;
                } else if let Some(client) = &client {
                    match client.artwork(artist["reference"].as_str().ok_or("ref missing")?, kind) {
                        Ok(bytes) => println!("Uncached {kind} fetched: {} bytes", bytes.len()),
                        Err(error) => println!("Uncached {kind}: {error}"),
                    }
                }
            }
        }
    }
    if let Some(client) = client {
        client.request("DELETE", "/api/auth/v1/session", &[], None)?;
    }
    println!("Public cache readable artwork: {hits}/{expected}");
    Ok(())
}
