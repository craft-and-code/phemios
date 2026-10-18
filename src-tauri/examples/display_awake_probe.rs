//! Explicit, temporary OS assertion probe; it never opens audio or changes persistent OS settings.
#[path = "../src/display_awake.rs"]
mod display_awake;
fn main() -> Result<(), String> {
    let awake = display_awake::Awake::new();
    let scope = awake.open()?;
    awake.update(&scope, true)?;
    #[cfg(target_os = "macos")]
    assert!(
        assertions()? >= 2,
        "display and idle assertions must both be visible"
    );
    awake.update(&scope, false)?;
    #[cfg(target_os = "macos")]
    assert_eq!(assertions()?, 0, "the process must release its assertions");
    println!("Display/idle assertion acquired and released successfully.");
    Ok(())
}
#[cfg(target_os = "macos")]
fn assertions() -> Result<usize, String> {
    let output = std::process::Command::new("/usr/bin/pmset")
        .args(["-g", "assertions"])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("OS assertion inspection failed".into());
    }
    let identity = format!("pid {}(", std::process::id());
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| line.contains(&identity) && line.contains("Phemios audio playback"))
        .count())
}
