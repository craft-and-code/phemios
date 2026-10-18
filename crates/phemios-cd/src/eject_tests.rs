use super::*;
#[test]
fn arbitrary_paths_and_shell_syntax_are_not_ejection_targets() {
    for path in [
        "",
        "/tmp/file",
        "disk1;echo bad",
        "disk1/../disk0",
        "disk1\n",
    ] {
        assert!(command(path).is_err());
    }
}
#[cfg(target_os = "macos")]
#[test]
fn discovered_macos_path_is_a_separate_argument_to_the_fixed_system_tool() {
    let c = command("disk9").unwrap();
    assert_eq!(c.get_program(), "/usr/sbin/diskutil");
    assert_eq!(c.get_args().collect::<Vec<_>>(), ["eject", "/dev/disk9"]);
}
