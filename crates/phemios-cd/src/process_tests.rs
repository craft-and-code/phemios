use super::*;
#[test]
fn pipe_fixture() {
    match std::env::var("PHEMIOS_CD_PIPE_FIXTURE").as_deref() {
        Ok("large") => {
            use std::io::Write;
            let _ = std::io::stdout().write_all(&[b'x'; 16384]);
        }
        Ok("stall") => std::thread::sleep(Duration::from_secs(60)),
        _ => {}
    }
}
fn fixture(mode: &str) -> Command {
    let mut command = Command::new(std::env::current_exe().unwrap());
    command
        .args(["--exact", "process::tests::pipe_fixture", "--nocapture"])
        .env("PHEMIOS_CD_PIPE_FIXTURE", mode)
        .stdin(Stdio::null());
    command
}
#[test]
fn oversized_probe_output_is_refused_without_retaining_an_unbounded_buffer() {
    let mut process = Process::spawn(fixture("large"), 1024).unwrap();
    assert!(process.text().unwrap_err().contains("volumineuses"));
}
#[test]
fn a_stalled_external_decoder_has_a_total_read_deadline() {
    let mut process = Process::spawn(fixture("stall"), 1024).unwrap();
    let start = std::time::Instant::now();
    assert!(process.read(65536).is_err());
    assert!(start.elapsed() >= Duration::from_secs(4));
    assert!(start.elapsed() < Duration::from_secs(8));
}
