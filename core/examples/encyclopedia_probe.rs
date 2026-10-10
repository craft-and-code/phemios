//! Explicit read-only public Wikipedia acceptance; no Aède account or private library is involved.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = phemios_core::encyclopedia::Client::default();
    for (language, term) in [("fr", "guerre du volume"), ("en", "loudness war")] {
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
        println!(
            "{language}: {} results; page {id}; revision {}; {} text bytes",
            search["rows"].as_array().map_or(0, Vec::len),
            article["revision"],
            article["text"].as_str().map_or(0, str::len)
        );
    }
    Ok(())
}
