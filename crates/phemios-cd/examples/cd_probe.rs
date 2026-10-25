//! Read-only host discovery. This example never opens an output device or contacts a server.
fn main() -> Result<(), String> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if !args.is_empty() && args != ["--metadata"] {
        return Err("Usage: cd_probe [--metadata]".into());
    }
    let mut library = phemios_cd::Library::default();
    let drives = library.scan()?;
    println!(
        "Optical drives: {}; readable audio discs: {}",
        drives.len(),
        drives.iter().filter(|d| d.disc.is_some()).count()
    );
    if !args.is_empty() {
        for drive in drives {
            println!("Drive: {}", drive.name);
            if let Some(disc) = &drive.disc {
                println!(
                    "Disc: {} / {}",
                    disc.title().unwrap_or("<unidentified>"),
                    disc.performer().unwrap_or("<unidentified>")
                );
                for track in &disc.tracks {
                    let (title, performer) = disc.track_names(track.number);
                    println!(
                        "  Track {}: {} / {}",
                        track.number,
                        title.unwrap_or("<unidentified>"),
                        performer.unwrap_or("<unidentified>")
                    );
                }
            } else {
                println!("No readable audio disc.");
            }
        }
    }
    Ok(())
}
