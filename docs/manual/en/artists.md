# Stories and connections

An artist page brings together a biography, discography and albums they contributed to when credits exist. From an album or track, follow an artist, country, genre or label to keep exploring.

## Follow a contribution

Credits describe roles actually present in the catalogue. A guest guitarist is not necessarily a band member. Relations represents collaborations and can lead to an artist or album. Rotate the graph to explore neighbours; a link is not proof of membership.

An empty discography may reflect missing credits, external metadata or available albums. Enrichment never replaces local file information.

## Read a biography

Read more opens the available long text, with a contents list for articles with several sections. The bottom arrow returns to the top. The download icon beside the title exports the retained text with its source, revision and licence.

The heart immediately to the left of Download saves the complete biography as a private copy for the active account. Find it in **Encyclopedia → Saved articles**, selecting the same FR/EN edition. An already retained revision is marked and cannot be saved twice; a newer revision can replace it. Without a writable account the action is disabled. Saved biographies use the same account backup as other saved articles.

Wikipedia articles are extracts: tables, images and references may be omitted. Follow the original link for the complete page. Retrieved articles are cached for reading; a changed revision may require an update.

Resources in the External links section retain their clickable addresses, including saved copies and downloaded text. For an older saved copy without links, refresh the article and save it again.

## Retrieve images and biographies

After scanning folders, run enrichment to retrieve available covers, portraits, banners, logos, backgrounds and biographies.

1. Open **Settings → External sources**. Starting a task requires an administrator account for the library concerned; the local engine has its own session.
2. For banners and backgrounds, enter your **Fanart.tv** key and click **Save shared keys**. MusicBrainz, Cover Art Archive, Wikipedia, Wikidata and the supported Discogs passes need no key in this interface. AcoustID concerns identification rather than banners.
3. Under **Enrich the library**, choose **Local**, **Server** or both when those libraries are available and administrable.
4. Select **Covers**, **Biographies** and, with its key configured, **Fanart.tv · banners and backgrounds**. **Discogs · label biographies** completes labels; **Lyrics** can join the same batch.
5. Click **Start enrichment**, follow the displayed task and wait for its result. MusicBrainz first identifies artists and albums; selected providers then fill in their information.
6. Synchronize that source’s catalogue if needed, then reopen an artist or album page to see retrieved information.

Retrieval needs an Internet connection. Uncertain matches may need confirmation in Aède. No provider guarantees an image for every artist or album: a completed task can leave artwork missing. Phémios subsequently reuses cached images; opening a page does not restart all enrichment.

**Stop enrichment** cancels active enrichment tasks for the relevant sources; it is disabled while idle. Previously saved results remain available. Wait for cancellation confirmation before launching again.

A biography requires an approved identity and a Wikidata link in the MusicBrainz data. Without identifiers in the tags, name searches propose matches for approval in Aède (`aede review --interactive`). A Wikipedia search result in the Encyclopedia is not that approval. Picard can supply file identifiers, but is not required. Repeating enrichment never automatically approves a proposal or fills an already cached record without an explicit refresh in Aède.

Missing albums are discography suggestions, not playable files. Their display is configurable; the cross hides a suggestion, which remains accessible among hidden suggestions. [Aède](https://craft-and-code.github.io/aede/docs/en/index.html) documents providers, attribution and identification.
