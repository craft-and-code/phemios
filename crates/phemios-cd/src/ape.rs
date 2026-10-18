//! Optional APE support uses a pinned regular-file descriptor, never a URL or shell command.
use super::{
    decoded::{self, INVALID},
    process::Process,
};
use std::{
    collections::BTreeMap,
    fs::File,
    io::{Seek, SeekFrom},
    process::{Command, Stdio},
};
fn locate(program: &str, paths: &[std::path::PathBuf]) -> Option<std::path::PathBuf> {
    let name = if cfg!(windows) {
        format!("{program}.exe")
    } else {
        program.into()
    };
    paths
        .iter()
        .filter(|p| p.is_absolute())
        .map(|p| p.join(&name))
        .find(|p| p.is_file())
}
fn input(program: &str, file: &File) -> Result<Command, String> {
    let mut file = file.try_clone().map_err(|_| INVALID)?;
    file.seek(SeekFrom::Start(0)).map_err(|_| INVALID)?;
    let paths = std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect::<Vec<_>>())
        .unwrap_or_default();
    #[cfg(target_os = "macos")]
    let paths = paths
        .into_iter()
        .chain(["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"].map(std::path::PathBuf::from))
        .collect::<Vec<_>>();
    let program = locate(program, &paths)
        .ok_or("APE nécessite FFmpeg et FFprobe installés, avec le protocole fd.")?;
    let mut command = Command::new(program);
    command
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-protocol_whitelist",
            "fd,pipe",
            "-f",
            "ape",
        ])
        .stdin(Stdio::from(file));
    Ok(command)
}
pub(super) fn frames(file: &File) -> Result<u64, String> {
    let mut command = input("ffprobe", file)?;
    command.args([
        "-i",
        "fd:",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=sample_rate,channels,bits_per_sample,bits_per_raw_sample,duration_ts,time_base",
        "-of",
        "default=noprint_wrappers=1",
    ]);
    let text = Process::spawn(command, 1024)?.text()?;
    parse(&text)
}
fn parse(text: &str) -> Result<u64, String> {
    let mut fields = BTreeMap::new();
    for line in text.lines() {
        let (key, value) = line.split_once('=').ok_or(INVALID)?;
        if fields.insert(key, value).is_some() {
            return Err(INVALID.into());
        }
    }
    if fields.get("sample_rate") != Some(&"44100")
        || fields.get("channels") != Some(&"2")
        || fields.get("time_base") != Some(&"1/44100")
        || match fields.get("bits_per_raw_sample") {
            Some(&"16") => false,
            None | Some(&"0") | Some(&"N/A") => fields.get("bits_per_sample") != Some(&"16"),
            _ => true,
        }
    {
        return Err(INVALID.into());
    }
    let frames = fields
        .get("duration_ts")
        .ok_or(INVALID)?
        .parse::<u64>()
        .map_err(|_| INVALID)?;
    decoded::sectors(frames)?;
    Ok(frames)
}
pub(super) struct Ape {
    process: Process,
    pub position: u64,
}
impl Ape {
    pub fn open(file: &File, frame: u64) -> Result<Self, String> {
        let mut command = input("ffmpeg", file)?;
        // Input seeking on a seekable descriptor; FFmpeg accurately discards pre-roll after decode.
        command.args([
            "-nostdin",
            "-ss",
            &format!("{:.12}", frame as f64 / 44100.),
            "-i",
            "fd:",
            "-map",
            "0:a:0",
            "-vn",
            "-sn",
            "-dn",
            "-threads",
            "1",
            "-f",
            "s16le",
            "-c:a",
            "pcm_s16le",
            "pipe:1",
        ]);
        Ok(Self {
            process: Process::spawn(command, 27 * 2352)?,
            position: frame,
        })
    }
    pub fn read(&mut self, count: usize) -> Result<Vec<u8>, String> {
        let bytes = self.process.read(count * 4)?;
        self.position += count as u64;
        Ok(bytes)
    }
}
#[cfg(test)]
#[path = "ape_tests.rs"]
mod tests;
