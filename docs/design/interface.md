# Interface contract

## Identity and navigation

Reuse Aède's dark surfaces, typography and accent palette. The dot in `phémios.` and primary buttons use the same accent token. Artist/album artwork is never removed by a compact display mode. Navigation can be hidden; the current cover and transport stay independent of list scrolling.

Start from artists, albums, compilations when present, countries when known, and genres. Keep favourites, smart collections, listening history, static M3U lists, relationship discovery and external-player export reachable. Artist pages distinguish owned discography, source-known missing releases, guest/compilation appearances, writing/production contributions, biography with attribution, dated membership and already-fetched images. Album details open as a full page with rating, favourites, tags, personal notes, tracks, credits, source disagreements and attributed analyses.

## Sliding filters

The user may show years, alphabet or both. Each rail has two bounds. Drag a bound to resize the interval; drag the selected band to move it while preserving its span. Keyboard arrows move the band; Home/End move it to domain edges. Display the chosen bounds throughout. Include separate treatment for unknown years and nonletter initials.

Year bounds are inclusive and come from the available catalog. Alphabet initials fold accents/case and map nonletters to `#`; alphabet filtering targets the names of the current list (artist names or album titles). Year filters on artists retain artists with a matching local release. Combined filters intersect. Changing the view preserves the chosen filter configuration and visibly identifies its context.

## Countries and relations

Countries use a rotatable, zoomable globe with actual geographic boundaries bundled locally, country picking and a keyboard-accessible country list. Unknown origin remains explicit. Country counts follow sourced artist origins, never pressing countries. The renderer and public-domain asset are documented in `geography.md`.

Relationship discovery uses the existing graph: performers, collaborators, credited roles and dated membership. A collaboration does not become band membership. Edges retain roles, periods and provenance. Provide keyboard/list navigation alongside the graph and bound visible graph work.

## Media and playback

Use banners at the top of the artist page and a legible, subdued background only when already fetched. Portraits, logos, album covers, booklets and cdART retain their identity and attribution. No automatic external enrichment. Cache artwork on disk per server/account/version, with a bounded decoded-memory working set, pinned visible images and directional prefetch. Never persist account secrets in browser preferences.

Lyrics follow consumed playback time; simulations and physical-output evidence stay distinct. Moving visualizations observe the consumed signal, respect reduced motion and do not block audio or catalog rendering. Native strict bit-perfect is route-specific; processed remote PCM is not proof of original output. Volume/output controls reflect the capabilities of the selected route.

## External players and export

Separate audio-output devices from mounted storage destinations. The export page selects an existing attached player/card/drive, selection or collection, sidecars, verification of newly written and existing files, optional supported conversion and destination playlists. Preview before transfer. A disconnected destination must never become a new local folder. Preserve Aède's path/overlap, source-integrity, atomic-publication and explicit replacement rules. Lossy conversion is not byte equality with the source. Do not duplicate these rules in a browser-only copier.

## Integration boundaries

Native artwork/prose, paged tag search/current-owner annotations, private M3U publication and scoped analysis tasks are defined in `native-integration.md`. Collection evaluation, richer dated credits/relations, device control/registry, native playback and mounted-player copy still require their own frontend/native orchestration. Never infer HTTP endpoints from CLI availability. Downloaded M3U paths/URLs must match the intended local/remote client and authorization context.

## Browsing controls

Years are the sole default rail. Each visibility icon toggles independently, including neither; hidden intervals never keep filtering. Date-unknown inclusion is shown only when undated releases exist and the year rail is active. Country selection is a union, intersected with other facets: ordinary activation replaces it, Command on macOS or Control on Windows/Linux toggles individual countries. Globe and keyboard-accessible country buttons share this policy.

The main artist/country/genre catalog lists only artists referenced by Aède's canonical album-artist field, matching singular Submariner browsing. Supporting credits remain in the full catalog for search, participations, favourites and relation exploration; a supporting musician with their own release is also a principal artist. Names and external person/group classifications never decide inclusion.

Connection popovers close via outside pointer activation or Escape, keep focus within while open and restore trigger focus on dismissal. Field focus uses the whole input edge rather than an offset partial outline.

### Visual personal notes

Artist and album pages use the same current-owner annotation component. Stars and the favourite heart have 18 px glyphs, unframed controls (28 px high), labels and pressed states. Star glyph edges overlap slightly through a 14 px horizontal step; neighbouring hit areas do not overlap, so the fourth star cannot activate the fifth. Clicking the selected rating again clears all stars; clicking another selects that rating. CommonMark notes use the explicitly approved Milkdown kit with bold, italic, heading, paragraph, lists, quote and undo/redo icons. Stored Markdown is hidden during normal editing. Account/server annotations remain authoritative; explicit save and errors preserve the draft. Untouched note source is not normalized by merely opening the editor.

### Statistics

The sidebar exposes whole-library statistics independently of catalog filters: albums/compilations, tracks/files, distinct principal/credited artists, duration/bytes, genres/labels, orphan tracks, completeness, codecs, encoded quality classes, sample rates, decades, sourced origins, credit roles and artist/writer rankings. Every breakdown is bounded and independently paged. Server diagnostics report saved integrity and pending analysis counts without running new tasks. The local coverage section shows unknown metadata and available media; owner favourites, ratings, notes and tags stay separate. Offline values are labelled as public snapshot counts, never invented server totals. Refresh creates a new consistent scan epoch.
