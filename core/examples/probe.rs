//! Read-only native-client smoke probe. Credentials arrive on stdin, never arguments.
use phemios_core::{cache::Cache, network::Client};
use std::io::Read;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = String::new();
    std::io::stdin().take(8192).read_to_string(&mut input)?;
    let credentials: serde_json::Value = serde_json::from_str(&input)?;
    let value = |field: &str| {
        credentials[field]
            .as_str()
            .ok_or("missing credential field")
    };
    let client = Client::login(value("server")?, value("username")?, value("password")?)?;
    let snapshot = client.snapshot()?;
    let folder = std::env::temp_dir().join(format!(
        "phemios-probe-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_nanos()
    ));
    let cache = Cache::new(folder.clone());
    let snapshot = cache.save(snapshot)?;
    let artists = snapshot["artists"]
        .as_array()
        .ok_or("invalid artists")?
        .len();
    let albums = snapshot["albums"].as_array().ok_or("invalid albums")?;
    let mut images = 0;
    let mut unavailable = 0;
    for album in albums.iter().filter(|album| album["cover"] == true) {
        let reference = album["reference"].as_str().ok_or("invalid reference")?;
        let bytes = match client.artwork(reference, "cover") {
            Ok(bytes) => bytes,
            Err(_) => {
                unavailable += 1;
                continue;
            }
        };
        cache.save_image(&snapshot, reference, "cover", &bytes)?;
        if cache.image(&snapshot, reference, "cover")? != Some(bytes) {
            return Err("image cache mismatch".into());
        }
        images += 1;
        break;
    }
    if images == 0 {
        return Err("no readable cover found".into());
    }
    println!("Unavailable images before first readable cover: {unavailable}");
    if cache.load()?.as_ref() != Some(&snapshot) {
        return Err("catalog cache mismatch".into());
    }
    client.request("DELETE", "/api/auth/v1/session", &[], None)?;
    std::fs::remove_dir_all(folder)?;
    println!(
        "Native HTTP/cache probe passed: {artists} artists, {} albums, {images} verified cover.",
        albums.len()
    );
    Ok(())
}
