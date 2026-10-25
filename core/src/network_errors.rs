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
    let parental = match code {
        Some("parental_outside_schedule") => Some("Cette plage horaire n’autorise pas l’écoute."),
        Some("parental_daily_limit") => Some("La durée d’écoute maximale du jour est atteinte."),
        Some("parental_weekly_limit") => {
            Some("La durée d’écoute maximale de la semaine est atteinte.")
        }
        Some("parental_radio_blocked") => Some("L’accès aux radios est interdit pour ce compte."),
        Some("parental_podcast_blocked") => Some("Ce podcast est masqué pour ce compte."),
        Some("parental_artist_blocked") => Some("Cet artiste est masqué pour ce compte."),
        Some("parental_policy_unavailable") => {
            Some("Le contrôle parental ne peut pas être vérifié. Reconnectez Aède.")
        }
        Some("parental_locked") => {
            Some("Ce compte est verrouillé par son administrateur responsable.")
        }
        Some("parental_administrator_required") => {
            Some("Connectez un compte administrateur pour verrouiller ces règles.")
        }
        Some("parental_conflict") => {
            Some("Ces règles ont été modifiées ailleurs. Actualisez avant d’enregistrer.")
        }
        _ => None,
    };
    if let Some(message) = parental {
        return message.into();
    }
    if status == 500 && code == Some("user_unavailable") {
        return "Les données personnelles ne peuvent pas être lues par Aède. Vérifiez la compatibilité de sa version.".into();
    }
    if method == "GET" && (path == "/api/me/v1/m3u-files" || super::library_playlist_path(path)) {
        let message = match (status, code) {
            (404, Some("m3u_file_not_found")) => {
                Some("Ce fichier M3U n’est plus présent dans vos dossiers. Actualisez la liste.")
            }
            (409, Some("m3u_files_changed")) => {
                Some("Le fichier ou les dossiers M3U ont changé. Actualisez la liste.")
            }
            (413, Some("m3u_files_too_large")) => {
                Some("L’inventaire ou le fichier M3U dépasse les limites de lecture.")
            }
            (422, Some("m3u_text_invalid")) => {
                Some("Ce fichier M3U doit être un texte UTF-8 sans caractère NUL.")
            }
            (422, Some("m3u_path_invalid")) => {
                Some("Le chemin d’un fichier M3U n’est pas un texte UTF-8 valide ou est trop long.")
            }
            (503, Some("m3u_files_timeout")) => {
                Some("L’inventaire M3U a pris trop de temps. Vérifiez vos disques et réessayez.")
            }
            (503, Some("m3u_file_unavailable")) => {
                Some("Ce fichier M3U est momentanément illisible. Réessayez.")
            }
            _ => None,
        };
        if let Some(message) = message {
            return message.into();
        }
    }
    if status == 404
        && method == "GET"
        && path == "/api/v1/presentation/tracks"
        && code == Some("not_found")
    {
        return "Mettez à jour puis redémarrez Aède pour afficher les disques et pistes de cet album.".into();
    }
    if status == 409
        && ((method == "PUT" && create_only) || method == "PATCH")
        && path == "/api/me/v1/collection"
        && code == Some("collection_exists")
    {
        return "Une collection porte déjà ce nom. Choisissez un autre nom.".into();
    }
    match status {
        400 | 422 => "Aède a refusé les paramètres de cette requête.".into(),
        500..=599 if !matches!(status, 503) => "Erreur interne du serveur Aède.".into(),
        _ => failure(status),
    }
}
