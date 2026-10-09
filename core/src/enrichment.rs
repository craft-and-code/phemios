//! Private request preparation for shared app-owned service credentials.
use serde_json::{Value, json};
/// Attach only retained native keys after capability discovery; never accept keys from the WebView.
pub fn attach_service_keys(body: &mut Value, keys: &Value, status: &Value) -> Result<(), String> {
    let request = body
        .as_object_mut()
        .ok_or("Demande d’enrichissement invalide.")?;
    if request.contains_key("service_keys") {
        return Err("Les clés des sources externes restent dans la configuration native.".into());
    }
    let mut shared = json!({});
    for (stored, wire) in [("fanart", "fanarttv"), ("acoustid", "acoustid")] {
        if let Some(value) = keys.get(stored) {
            let key = value.as_str().ok_or("Clés invalides.")?;
            if key.trim().is_empty() || key.len() > 1024 || key.chars().any(char::is_control) {
                return Err("Clé API invalide.".into());
            }
            shared[wire] = key.into();
        }
    }
    if shared.as_object().is_some_and(|object| !object.is_empty()) {
        if !status["capabilities"]
            .as_array()
            .is_some_and(|rows| rows.iter().any(|row| row == "fetch_service_keys"))
        {
            return Err(
                "Mettez à jour puis redémarrez Aède pour utiliser les clés communes.".into(),
            );
        }
        request.insert("service_keys".into(), shared);
    }
    Ok(())
}
#[cfg(test)]
#[path = "enrichment_tests.rs"]
mod tests;
