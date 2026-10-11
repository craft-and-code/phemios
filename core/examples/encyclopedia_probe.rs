//! Explicit read-only public Wikipedia acceptance; no Aède account or private library is involved.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = phemios_core::encyclopedia::Client::default();
    for (language, term) in [
        ("fr", "guerre du volume"),
        ("en", "loudness war"),
        ("fr", "Ozzy Osbourne"),
    ] {
        let search = client.search(language, term)?;
        let first = search["rows"]
            .as_array()
            .and_then(|rows| rows.first())
            .ok_or("no results")?;
        let id = first["pageId"].as_u64().ok_or("missing id")?;
        let article = client.article(language, id)?;
        if article["pageId"].as_u64() != Some(id)
            || article["revision"].as_u64().is_none()
            || article["text"]
                .as_str()
                .is_none_or(|text| text.trim().is_empty())
        {
            return Err("invalid article evidence".into());
        }
        let target = if language == "fr" { "en" } else { "fr" };
        let counterpart = client.translated_article(language, id, target)?;
        let counterpart_id = counterpart["pageId"]
            .as_u64()
            .ok_or("missing counterpart id")?;
        if counterpart["language"] != target {
            return Err("wrong counterpart language".into());
        }
        let back = client.translated_article(target, counterpart_id, language)?;
        if back["pageId"].as_u64() != Some(id) {
            return Err("counterpart did not return to the original identity".into());
        }
        println!(
            "edition round trip: {language}/{id} -> {target}/{counterpart_id} -> {language}/{id}"
        );
        println!(
            "{language}: {} results; page {id}; revision {}; {} text bytes",
            search["rows"].as_array().map_or(0, Vec::len),
            article["revision"],
            article["text"].as_str().map_or(0, str::len)
        );
    }
    Ok(())
}
