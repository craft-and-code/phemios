#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(error) = phemios_lib::run() {
        eprintln!("Unable to start Phémios: {error}");
        std::process::exit(1);
    }
}
