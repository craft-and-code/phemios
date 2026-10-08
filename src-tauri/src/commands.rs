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
