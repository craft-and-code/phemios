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

Native artwork/prose, paged tag search/current-owner annotations, private M3U publication and scoped analysis tasks are defined in `native-integration.md`. Collection evaluation, richer dated credits/relations, persistent device profiles, repeat/shuffle/lyrics/effects and mounted-player copy still require their own frontend/native orchestration. Never infer HTTP endpoints from CLI availability. Downloaded M3U paths/URLs must match the intended local/remote client and authorization context.

## Browsing controls

Years are the sole default rail. Each visibility icon toggles independently, including neither; hidden intervals never keep filtering. Date-unknown inclusion is shown only when undated releases exist and the year rail is active. Country selection is a union, intersected with other facets: ordinary activation replaces it, Command on macOS or Control on Windows/Linux toggles individual countries. Globe and keyboard-accessible country buttons share this policy.

The main artist/country/genre catalog lists only artists referenced by Aède's canonical album-artist field, matching singular Submariner browsing. Supporting credits remain in the full catalog for search, participations, favourites and relation exploration; a supporting musician with their own release is also a principal artist. Names and external person/group classifications never decide inclusion.

Connection popovers close via outside pointer activation or Escape, keep focus within while open and restore trigger focus on dismissal. Field focus uses the whole input edge rather than an offset partial outline.

### Visual personal notes

Artist and album pages use the same current-owner annotation component. Stars and the favourite heart have 18 px glyphs, unframed controls (28 px high), labels and pressed states. Star glyph edges overlap slightly through a 14 px horizontal step; neighbouring hit areas do not overlap, so the fourth star cannot activate the fifth. Clicking the selected rating again clears all stars; clicking another selects that rating. CommonMark notes use the explicitly approved Milkdown kit with bold, italic, heading, paragraph, lists, quote and undo/redo icons. Stored Markdown is hidden during normal editing. Account/server annotations remain authoritative. Stars and heart save on activation, with ordered single-field writes and visible failure/rollback. Notes and tags alone use the explicit save button; icon responses preserve their draft. Untouched note source is not normalized by merely opening the editor.

### Statistics

The sidebar exposes whole-library statistics independently of catalog filters: albums/compilations, tracks/files, distinct principal/credited artists, duration/bytes, genres/labels, orphan tracks, completeness, codecs, encoded quality classes, sample rates, decades, sourced origins, credit roles and artist/writer rankings. Every breakdown is bounded and independently paged. Server diagnostics report saved integrity and pending analysis counts without running new tasks. The local coverage section shows unknown metadata and available media; owner favourites, ratings, notes and tags stay separate. Offline values are labelled as public snapshot counts, never invented server totals. Refresh creates a new consistent scan epoch.

Detail return links sit at the far left of the catalog toolbar, vertically centered against the right-side view controls, outside the artist/album header. Artist headers blur only their translucent fallback surface when no banner is loaded; an available banner remains sharp. The attributed biography precedes discography, participations and personal annotations. Album artwork opens a native dialog with a large image, Escape/outside-click dismissal and keyboard focus restoration. Annotation headings and acknowledgements explicitly distinguish the artist from the album; no inheritance is implied.

FlacCompagnon results render measured SVG scales for loudness, dynamics, peaks, bit depth, cutoff, stereo and phase bands, plus a bounded retained-event timeline. Graphs mount only when a track detail is expanded. Missing values are unknown; stale results remain labelled. At most 1000 retained event positions are drawn and the total/retained/displayed counts remain distinct. Original-format track/album JSON downloads are reconstructed by Aède, including unknown retained fields. No measurement is generated by the renderer.

Catalog rails and their bounds apply only to catalog lists, never to individual artist/album pages. Returning to the catalog preserves the bounds. Favourites display directly loved albums plus the principal discography of loved artists, with no duplicates or implicit inclusion through guest credits. Personal page errors stay inside the content area; sidebar navigation remains usable.

Relations use an explicit local artist search and a bounded row of starting-point choices instead of a dropdown. The SVG has its own aspect ratio and never inherits icon dimensions. Statistics place overall totals first, integrity/saved analyses second and current-owner music third, before detailed metadata breakdowns. Cover-dialog initial focus goes to its title; keyboard focus on the close icon follows the full border.

Personal tags use removable pills, committed with Enter/comma or an explicit note/tag save. Suggestions are bounded prefix matches of previously saved current-account annotation tags, excluding selected values. Arrow keys choose suggestions; Escape dismisses them and IME composition is preserved. Pending text participates in dirty status and is included on save. No suggestion vocabulary is stored in the public cache or fetched from another owner.

Album track rows expose compact labelled analysis/spectrum icon toggles. Expanded analysis contains its JSON download icon; collapsed rows have no redundant result label or large vertical gap. Measurements use larger numeric typography and SVG dimensions independent of icons. Spectra can be hidden/reopened while their resident image is reused. Album analysis/generation controls and the complete-report download sit after the track list.

The connection form remembers only the last successful server/username in a versioned local preference, preserving malformed records and reporting storage failure. Passwords/tokens remain ephemeral. Tag tokens appear below their text field, with individual removal crosses. Only the field wrapper has a focus border; the inner native input has none. Restored album-cover keyboard focus follows the image edge with an inset outline.

## Detail backdrops, relations and analysis reading

Artist backgrounds start after the banner and use a sticky layer within the artist body: they scroll to the content viewport top, then remain there until the artist body's bottom. The banner stays sharp; only the no-banner header uses backdrop blur.

Relations use bounded Fibonacci-sphere geometry with yaw/pitch/perspective/depth ordering, pointer rotation, wheel/button zoom and keyboard alternatives. SVG rendering remains local and idle without an animation loop or new dependency. Depth/orbits are decorative placement, not a musical-proximity metric; edge weights and provenance retain Aède's collaboration meaning and the link list remains accessible.

FlacCompagnon reading separates MD5 integrity, authenticity-detection findings and passages to audition. Missing checks stay unknown; obsolete/unconfirmed reports never verify the current source. Clean means no finding in completed checks, not proof of provenance or perceived quality. Values and neutral measurement bars describe level/dynamics rather than a score. Definitions are taken from the local FlacCompagnon source contract, including `Match`, `Mismatch`, `NoSignature`, `Present`, `Error` and `Clean`/`Flagged`/`Not analyzed`.

Every relationship node retains a visible name. Dense graphs place the names in separate perimeter rows with thin leader lines; the centre label paints above neighbours. Node shading darkens with projected distance from the visual centre, without claiming musical proximity. The accessible list remains available.

Detail return controls follow the actual originating page, including its scroll position and active sidebar section. Hash history is stored per entry; a direct detail link has a safe artist/album catalog fallback. Album artist names are explicit links to their own pages. Album tracks are grouped by nullable server disc numbers, preserve per-disc numbering and absolute queue indices, and load lightweight pages before fetching expanded analysis bodies. Retained report coverage lists missing measurements without substituting other tracks or inferred zeroes.

The footer uses equal outer columns around the transport so its centre is independent of title length. Statistic tiles wrap as whole tiles with content-sized minimum widths; each measurement and unit remains on one line.

Album actions share icon-only controls beside the track heading. Footer Play is the album start action; track-level Play remains independent. Album artist links use the same undecorated hover style as cards. Return arrows are inline SVG aligned with text. Native context menus are suppressed within the application surface. Statistic tiles keep a common preferred width without stretching an orphan tile across the row. Expanded spectra expose explicit collision-safe native image download, alongside the retained analysis JSON export.

Album years are explicit metadata actions: a known year opens Albums with the year rail enabled at that exact year, clearing unrelated browsing criteria. This displays all catalog releases from that year rather than only the previously selected artist or facet. Unknown years are not clickable. Annotation pencils stay next to the notes/tags heading, and editing actions have a wrapping spaced row. Recent additions use a sparkle icon independently of history.
