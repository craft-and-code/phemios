//! Explicit host acceptance of the local picker/roots exclusion contract, using disposable silent WAVs.
use phemios_core::{local::Engine, network::Client};
use serde_json::Value;
use std::{
    path::PathBuf,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
fn scan(engine: &Engine, client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    let request = engine.scan_request(true, 1)?;
    let task = client.request("POST", "/api/admin/v1/scan", &[], Some(&request))?;
    engine.accepted_scan()?;
    let route = format!(
        "/api/admin/v1/tasks/{}",
        task["task_id"].as_u64().ok_or("missing task id")?
    );
    let deadline = Instant::now() + Duration::from_secs(15);
    loop {
        let task = client.request("GET", &route, &[], None)?;
        if task["status"] == "completed" {
            return Ok(());
        }
        if task["status"] == "failed" || task["status"] == "cancelled" || Instant::now() >= deadline
        {
            return Err(format!("scan did not complete: {task}").into());
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}
fn tracks(client: &Client) -> Result<usize, Box<dyn std::error::Error>> {
    Ok(client.request(
        "GET",
        "/api/v1/presentation/tracks",
        &[("limit", "200")],
        None,
    )?["items"]
        .as_array()
        .ok_or("missing tracks")?
        .len())
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let binary = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .ok_or("supply the existing Aède binary")?;
    let root = std::env::temp_dir().join(format!(
        "phemios-exclusions-{}-{}",
        std::process::id(),
        SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos()
    ));
    let music = root.join("music");
    let excluded = music.join("excluded");
    std::fs::create_dir_all(&excluded)?;
    // A complete mono 16-bit 44.1 kHz silent WAV; no decoder or audio device is opened here.
    let samples = 8820u32;
    let mut wav = Vec::new();
    wav.extend(b"RIFF");
    wav.extend((36 + samples).to_le_bytes());
    wav.extend(b"WAVEfmt ");
    wav.extend(16u32.to_le_bytes());
    wav.extend(1u16.to_le_bytes());
    wav.extend(1u16.to_le_bytes());
    wav.extend(44100u32.to_le_bytes());
    wav.extend(88200u32.to_le_bytes());
    wav.extend(2u16.to_le_bytes());
    wav.extend(16u16.to_le_bytes());
    wav.extend(b"data");
    wav.extend(samples.to_le_bytes());
    wav.resize(wav.len() + samples as usize, 0);
    std::fs::write(music.join("kept.wav"), &wav)?;
    std::fs::write(excluded.join("skipped.wav"), &wav)?;
    let mut engine = Engine::new(root.join("app"), binary);
    engine.add_roots(std::slice::from_ref(&music))?;
    let client = engine.start()?;
    let result = (|| -> Result<(), Box<dyn std::error::Error>> {
        scan(&engine, &client)?;
        assert_eq!(tracks(&client)?, 2);
        engine.root_action(excluded.to_str().ok_or("UTF-8 path")?, "exclude")?;
        let roots: Value = client.request("GET", "/api/v1/roots", &[("limit", "200")], None)?;
        assert!(
            roots["items"]
                .as_array()
                .ok_or("missing roots")?
                .iter()
                .any(|row| row["status"] == "excluded")
        );
        scan(&engine, &client)?;
        assert_eq!(tracks(&client)?, 1);
        engine.root_action(excluded.to_str().ok_or("UTF-8 path")?, "include")?;
        scan(&engine, &client)?;
        assert_eq!(tracks(&client)?, 2);
        assert!(excluded.join("skipped.wav").is_file());
        Ok(())
    })();
    let stopped = engine.stop();
    drop(engine);
    std::fs::remove_dir_all(&root)?;
    result?;
    stopped?;
    println!(
        "Local exclusion, excluded scan traversal and explicit inclusion passed with existing engine."
    );
    Ok(())
}
