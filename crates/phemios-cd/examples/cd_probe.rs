//! Read-only host discovery. This example never opens an output device or contacts a server.
fn main() -> Result<(), String> {
    let mut library = phemios_cd::Library::default();
    let drives = library.scan()?;
    println!(
        "Optical drives: {}; readable audio discs: {}",
        drives.len(),
        drives.iter().filter(|d| d.disc.is_some()).count()
    );
    Ok(())
}
