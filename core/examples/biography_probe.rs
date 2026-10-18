//! Explicit public title-based biography acceptance; prints evidence, never source prose.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = phemios_core::encyclopedia::Client::default();
    for language in ["fr", "en"] {
        let article = client.named_article(language, "Ozzy Osbourne")?;
        let text = article["text"].as_str().ok_or("missing text")?;
        let sections = text.lines().filter(|line| line.starts_with("==")).count();
        if article["language"] != language || sections == 0 {
            return Err("not a sectioned biography".into());
        }
        println!(
            "{language}: page {}, revision {}, {} bytes, {sections} sections",
            article["pageId"],
            article["revision"],
            text.len()
        );
    }
    Ok(())
}
