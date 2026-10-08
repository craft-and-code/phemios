//! Translate bounded, known error codes without echoing server-controlled text.
use super::{Value, failure};

pub(super) fn request_failure(
    status: u16,
    method: &str,
    path: &str,
    create_only: bool,
    detail: Option<&Value>,
) -> String {
    let code = detail.and_then(|v| v["error"]["code"].as_str());
    if status == 404
        && method == "GET"
        && path == "/api/v1/presentation/tracks"
        && code == Some("not_found")
    {
        return "Mettez à jour puis redémarrez Aède pour afficher les disques et pistes de cet album.".into();
    }
    if status == 409
        && method == "PUT"
        && path == "/api/me/v1/collection"
        && create_only
        && code == Some("collection_exists")
    {
        return "Une collection porte déjà ce nom. Choisissez un autre nom.".into();
    }
    match status {
        400 | 422 => "Aède a refusé les paramètres de cette requête.".into(),
        500..=599 if !matches!(status, 503) => {
            "Erreur interne du serveur Aède. Consultez son journal.".into()
        }
        _ => failure(status),
    }
}
