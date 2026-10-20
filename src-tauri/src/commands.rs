use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeInfo {
    bridge_version: u32,
    name: &'static str,
    version: &'static str,
    native: bool,
    embedded: serde_json::Value,
    capabilities: &'static [&'static str],
}

#[tauri::command]
pub(crate) fn runtime_info() -> Result<RuntimeInfo, String> {
    Ok(RuntimeInfo {
        bridge_version: phemios_core::BRIDGE_VERSION,
        name: "Phémios",
        version: env!("CARGO_PKG_VERSION"),
        native: true,
        capabilities: &["native_session_read"],
        embedded: serde_json::from_str(include_str!("../binaries/versions.json"))
            .map_err(|_| "Embedded version metadata is invalid".to_string())?,
    })
}

/// Open an explicit source URL in the system browser without exposing shell or file-opening capabilities.
#[tauri::command]
pub(crate) async fn external_open(version: u32, url: String) -> Result<(), String> {
    crate::aede::bridge(version)?;
    crate::aede::blocking(move || phemios_core::external_links::open_browser(&url)).await
}
