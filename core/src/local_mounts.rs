//! Mounted-volume evidence distinguishes an unmounted empty directory from an empty library.
use serde_json::Value;
use std::path::{Path, PathBuf};
fn mounted() -> Vec<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("/sbin/mount")
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .lines()
                    .filter_map(|line| {
                        line.split_once(" on ")
                            .and_then(|(_, tail)| tail.rsplit_once(" ("))
                            .map(|(path, _)| PathBuf::from(path))
                    })
                    .collect()
            })
            .unwrap_or_default()
    }
    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string("/proc/self/mountinfo")
            .map(|text| {
                text.lines()
                    .filter_map(|line| line.split_whitespace().nth(4))
                    .map(|path| {
                        PathBuf::from(
                            path.replace("\\040", " ")
                                .replace("\\011", "\t")
                                .replace("\\134", "\\"),
                        )
                    })
                    .collect()
            })
            .unwrap_or_default()
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        Vec::new()
    }
}
pub(super) fn mount_for(path: &Path) -> Option<String> {
    mounted()
        .into_iter()
        .filter(|mount| mount != Path::new("/") && path.starts_with(mount))
        .max_by_key(|mount| mount.components().count())
        .and_then(|mount| mount.to_str().map(str::to_owned))
}
pub(super) fn available(row: &Value) -> bool {
    let Some(path) = row["path"].as_str() else {
        return false;
    };
    if let Some(mount) = row["mount"].as_str()
        && !mounted()
            .iter()
            .any(|candidate| candidate == Path::new(mount))
    {
        return false;
    }
    Path::new(path).is_dir()
}
