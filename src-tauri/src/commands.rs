use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeInfo {
    bridge_version: u32,
    name: &'static str,
    version: &'static str,
    native: bool,
}

#[tauri::command]
pub(crate) fn runtime_info() -> RuntimeInfo {
    RuntimeInfo {
        bridge_version: phemios_core::BRIDGE_VERSION,
        name: "Phémios",
        version: env!("CARGO_PKG_VERSION"),
        native: true,
    }
}

/// Open an explicit source URL in the system browser without exposing shell or file-opening capabilities.
#[tauri::command]
pub(crate) async fn external_open(version: u32, url: String) -> Result<(), String> {
    crate::aede::bridge(version)?;
    crate::aede::blocking(move || phemios_core::external_links::open_browser(&url)).await
}
