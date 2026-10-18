//! Strict audio-only CDRWIN CUE admission. Unsupported storage/timing never becomes PCM.
use std::collections::BTreeMap;
#[derive(Default)]
pub(super) struct Sheet {
    pub files: Vec<String>,
    pub tracks: Vec<Entry>,
    pub title: Option<String>,
    pub performer: Option<String>,
}
pub(super) struct Entry {
    pub number: u8,
    pub file: usize,
    pub index: Option<u32>,
    pub pregap: Option<u32>,
    pub indexes: BTreeMap<u8, u32>,
    pub title: Option<String>,
    pub performer: Option<String>,
}
fn fields(line: &str) -> Result<Vec<String>, String> {
    let mut fields = Vec::new();
    let mut chars = line.chars().peekable();
    while chars.peek().is_some() {
        while chars.peek().is_some_and(|c| c.is_whitespace()) {
            chars.next();
        }
        let Some(first) = chars.next() else {
            break;
        };
        let mut text = String::new();
        if first == '"' {
            let mut closed = false;
            for c in chars.by_ref() {
                if c == '"' {
                    closed = true;
                    break;
                }
                text.push(c);
            }
            if !closed || chars.peek().is_some_and(|c| !c.is_whitespace()) {
                return Err("Syntaxe du fichier CUE invalide.".into());
            }
        } else {
            text.push(first);
            while chars.peek().is_some_and(|c| !c.is_whitespace()) {
                if let Some(c) = chars.next() {
                    text.push(c);
                }
            }
        }
        fields.push(text);
        if fields.len() > 8 {
            return Err("Syntaxe du fichier CUE invalide.".into());
        }
    }
    Ok(fields)
}
fn time(text: &str) -> Result<u32, String> {
    let parts = text.split(':').collect::<Vec<_>>();
    if parts.len() != 3
        || parts
            .iter()
            .any(|p| p.len() != 2 || !p.bytes().all(|b| b.is_ascii_digit()))
    {
        return Err("Position CUE invalide.".into());
    }
    let n = parts
        .iter()
        .map(|p| p.parse::<u32>())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| "Position CUE invalide.")?;
    if n[1] >= 60 || n[2] >= 75 {
        return Err("Position CUE invalide.".into());
    }
    Ok((n[0] * 60 + n[1]) * 75 + n[2])
}
pub(super) fn parse(text: &str) -> Result<Sheet, String> {
    let mut sheet = Sheet::default();
    for line in text.trim_start_matches('\u{feff}').lines() {
        if line.len() > 4096 {
            return Err("Fichier CUE trop volumineux.".into());
        }
        let line = line.trim();
        if line.is_empty()
            || line
                .split_whitespace()
                .next()
                .is_some_and(|s| s.eq_ignore_ascii_case("REM"))
        {
            continue;
        }
        let f = fields(line)?;
        let command = f
            .first()
            .ok_or("Syntaxe du fichier CUE invalide.")?
            .to_ascii_uppercase();
        match command.as_str() {
            "FILE" if f.len()==3 && ["BINARY", "WAVE", "FLAC", "APE"].iter().any(|kind| f[2].eq_ignore_ascii_case(kind)) => {
                if sheet.files.len()>=99 { return Err("Trop de fichiers dans l’image CD.".into()); }
                if !sheet.files.is_empty() && sheet.tracks.last().is_none_or(|t| t.file+1!=sheet.files.len()) {
                    return Err("Fichier audio sans piste audio.".into());
                }
                let extension=std::path::Path::new(&f[1]).extension().and_then(|s|s.to_str()).unwrap_or_default().to_ascii_lowercase();
                let valid=if f[2].eq_ignore_ascii_case("BINARY") {extension=="bin"} else if f[2].eq_ignore_ascii_case("WAVE") {["wav","flac","ape"].contains(&extension.as_str())} else {extension.eq_ignore_ascii_case(&f[2])};
                if !valid {return Err("Le type FILE du CUE ne correspond pas au fichier audio.".into());}
                sheet.files.push(f[1].clone());
            }
            "TRACK" if f.len()==3 && f[2].eq_ignore_ascii_case("AUDIO") => {
                let number=f[1].parse::<u8>().map_err(|_|"Piste CUE invalide.")?;
                if sheet.files.is_empty() || number==0 || number>99 || sheet.tracks.last().is_some_and(|t|t.number>=number) {
                    return Err("Piste CUE invalide.".into());
                }
                sheet.tracks.push(Entry {number,file:sheet.files.len()-1,index:None,pregap:None,indexes:BTreeMap::new(),title:None,performer:None});
            }
            "INDEX" if f.len()==3 => {
                let number=f[1].parse::<u8>().map_err(|_|"Position CUE invalide.")?;
                let position=time(&f[2])?;
                let track=sheet.tracks.last_mut().filter(|t|t.file+1==sheet.files.len()).ok_or("Piste CUE invalide.")?;
                if number>99 || track.indexes.last_key_value().is_some_and(|(n,p)|*n>=number || *p>position) {
                    return Err("Position CUE invalide.".into());
                }
                track.indexes.insert(number,position);
                if number==1 {track.index=Some(position);}
            }
            "PREGAP" | "POSTGAP" if f.len()==2 && time(&f[1])?==0 => {}
            // The conventional initial 2-second lead-in is outside programme audio.
            "PREGAP" if f.len()==2 && sheet.tracks.len()==1 && time(&f[1])?==150 => {
                let track=sheet.tracks.last_mut().ok_or("Piste CUE invalide.")?;
                if track.pregap.replace(150).is_some() {return Err("Position CUE invalide.".into());}
            }
            "TITLE" | "PERFORMER" if f.len()==2 && !f[1].is_empty() && f[1].chars().count()<=500 => {
                let value=Some(f[1].clone());
                match (command.as_str(),sheet.tracks.last_mut()) {
                    ("TITLE",Some(t))=>t.title=value,
                    ("PERFORMER",Some(t))=>t.performer=value,
                    ("TITLE",None)=>sheet.title=value,
                    _=>sheet.performer=value,
                }
            }
            "FLAGS" if f.len()>=2 && f[1..].iter().all(|s|s.eq_ignore_ascii_case("DCP")||s.eq_ignore_ascii_case("SCMS")) => {}
            "CATALOG" | "ISRC" | "SONGWRITER" | "CDTEXTFILE" if f.len()==2 => {}
            _ => return Err("Cette variante CUE n’est pas prise en charge : utilisez des pistes AUDIO avec BIN, FLAC, WAV ou APE, sans intervalle ajouté ni préaccentuation.".into()),
        }
    }
    if sheet.tracks.is_empty()
        || sheet
            .tracks
            .last()
            .is_none_or(|t| t.file + 1 != sheet.files.len())
        || sheet.tracks.iter().any(|t| t.index.is_none())
    {
        return Err("Le fichier CUE ne décrit aucune piste audio valide.".into());
    }
    Ok(sheet)
}
#[cfg(test)]
#[path = "cue_tests.rs"]
mod tests;
