//! Fuzzy TOC lookup is admitted only when a returned physical TOC matches exactly.
use super::*;
fn text(value: &Value) -> Result<String, String> {
    value
        .as_str()
        .filter(|s| {
            !s.trim().is_empty() && s.chars().count() <= 1000 && !s.chars().any(char::is_control)
        })
        .map(str::to_owned)
        .ok_or_else(|| "Réponse MusicBrainz invalide.".into())
}
fn credit(value: &Value) -> Result<String, String> {
    let rows = value
        .as_array()
        .filter(|r| !r.is_empty() && r.len() <= 32)
        .ok_or("Crédits MusicBrainz invalides.")?;
    let mut label = String::new();
    for row in rows {
        label.push_str(&text(&row["name"])?);
        if let Some(join) = row.get("joinphrase") {
            let join = join
                .as_str()
                .filter(|s| s.len() <= 100 && !s.chars().any(char::is_control))
                .ok_or("Crédits MusicBrainz invalides.")?;
            label.push_str(join);
        }
    }
    text(&json!(label))
}
fn exact(medium: &Value, toc: &[u32]) -> bool {
    medium["discs"]
        .as_array()
        .filter(|v| v.len() <= 100)
        .is_some_and(|discs| {
            discs.iter().any(|disc| {
                disc["sectors"].as_u64() == Some(u64::from(toc[2]))
                    && disc["offsets"].as_array().is_some_and(|offsets| {
                        offsets.len() == toc.len() - 3
                            && offsets
                                .iter()
                                .zip(&toc[3..])
                                .all(|(a, b)| a.as_u64() == Some(u64::from(*b)))
                    })
            })
        })
}
pub(super) fn result(value: &Value, toc: &[u32]) -> Result<Value, String> {
    let releases = value["releases"]
        .as_array()
        .filter(|r| r.len() <= 100)
        .ok_or("Réponse MusicBrainz invalide.")?;
    if value["release-offset"].as_u64().unwrap_or(0) != 0
        || value["release-count"]
            .as_u64()
            .is_some_and(|count| count != releases.len() as u64)
    {
        return Err("Réponse MusicBrainz incomplète.".into());
    }
    let mut selected = None;
    for release in releases {
        let media = release["media"]
            .as_array()
            .filter(|m| m.len() <= 99)
            .ok_or("Réponse MusicBrainz invalide.")?;
        for medium in media.iter().filter(|m| exact(m, toc)) {
            let tracks = medium["tracks"]
                .as_array()
                .filter(|t| t.len() == toc[1] as usize)
                .ok_or("Pistes MusicBrainz incomplètes.")?;
            let artist = credit(&release["artist-credit"])?;
            let mut names = Vec::new();
            for (index, track) in tracks.iter().enumerate() {
                if track["position"].as_u64() != Some(index as u64 + 1) {
                    return Err("Ordre des pistes MusicBrainz invalide.".into());
                }
                let performer = match track.get("artist-credit") {
                    Some(value) => credit(value)?,
                    None => artist.clone(),
                };
                names.push(json!({"title":text(&track["title"])?,"artist":performer}));
            }
            let candidate = json!({"status":"matched","title":text(&release["title"])?,"artist":artist,"tracks":names});
            if selected
                .as_ref()
                .is_some_and(|previous| *previous != candidate)
            {
                return Ok(json!({"status":"ambiguous"}));
            }
            selected = Some(candidate);
        }
    }
    Ok(selected.unwrap_or_else(|| json!({"status":"not_found"})))
}
