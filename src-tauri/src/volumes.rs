//! Narrow read-only mounted-destination discovery.
use crate::aede::{blocking, bridge};
#[tauri::command]
pub(crate) async fn players_discover(version: u32) -> Result<serde_json::Value, String> {
    bridge(version)?;
    blocking(|| {
        Ok(serde_json::Value::Array(
            phemios_core::volumes::discover()?
                .iter()
                .map(|row| row.json())
                .collect(),
        ))
    })
    .await
}
