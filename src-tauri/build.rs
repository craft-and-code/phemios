fn main() {
    println!("cargo:rerun-if-changed=binaries/versions.json");
    tauri_build::build()
}
