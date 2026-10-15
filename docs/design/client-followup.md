# Catalogue, playback and portable preferences follow-up

## Public browsing and retained selections

Explicit synchronization now retains complete public track rows and exact label associations/prose under the existing shared catalog byte budget and same scan epoch. Cached browsing is independent of account authentication; private queries/annotations and actual server audio still require their captured source session. Legacy artist/album-only caches stay valid and explain the one explicit synchronization required to add these records. Offline track search covers retained track/album titles, with a visible scope notice; it never fabricates file-tag or credit search facts. See [native integration](native-integration.md).

Advanced Search owns one bounded confirmed 50-row window and its submitted expression/draft in the application session rather than the disposable route renderer. Returning to the view reuses that result without another search. Explicit Search/Reset invalidates the saved window; identical catalog synchronization does not erase the form. Result publication also admits the exact submitted object and page, so a late preceding request cannot replace the retained selection, including an explicit refresh with identical criteria. Changes to connected native account generations or catalog epochs clear its private draft/result. No private search enters the public disk cache or portable preference backup.

Albums, Compilations and Genres share the thin native range with Cover Flow. Their account-owned size ranges from 100 to 280 pixels in ten-pixel steps. Library settings provide a general default (initially 150); changing it clears the three view overrides. Each rail persists its own override through the existing owner-scoped Aède preferences contract, and double-click restores the general default. Device-only choices remain in the separate device projection when no account is connected; backups include both default and overrides. Albums disables sizing in Cover Flow; the scene's existing rendering, motion and image residency policies are unchanged. Card grids use the selected minimum with a responsive available-width bound.

## Access and empty results

The shared AccountNotice renders inside its view after selection controls; centered empty states describe missing results with their section icon. Analysis additionally explains the administrator requirement for launching jobs; retained result reads do not become administrator-only. Concert public transport remains independent from library authentication. The obsolete legacy first-observed-date notice is removed from New releases without inventing addition dates.

## Explicit downloads

DownloadButton shares a rounded hit area, fixed activity glyph and confirmed green check retained for three seconds. The check appears only after successful publication (or confirmed lyrics-task completion), never on submission, cancellation, failure or a replaced reference/account. Export-state and podcast controllers retain the actual originating scope and hide old file feedback immediately on replacement. Errors retain the existing dismissible feedback contract. Task cancellation remains available in the queue's bulk acquisition control.

M3U downloads publish directly into the operating system Downloads directory with create-only collision suffixes and exact server bytes. Analysis, spectra, podcasts and encyclopedia exports retain their documented destinations. Personal notes export the server-confirmed Markdown for the exact account/entity, never the unsaved editor draft. Their download action appears beside the notes only when saved content is nonempty. Native code obtains the entity name from the same authenticated catalogue, sanitizes a bounded `Note-<name>.md` filename and publishes directly to system Downloads with create-only suffixes; native session admission is rechecked before publication. Downloads remain explicit user-owned files outside private application browsing state.

Queue lyrics availability is read independently per exact track and owner, publishing confirmed retained status progressively. Available lyrics have a non-interactive document glyph; missing lyrics can start that track's existing administrative acquisition. The bulk action updates the same glyphs and becomes unavailable when every track is covered. Leaving the drawer does not own/cancel the job. Ordinary progress/success paragraphs are omitted; actual errors render below the action row.

## Playback and backup scope

The queue drawer stays open after Stop, with the idle icon centered in the remaining scene. An idle horizontal waveform has a default pointer. Floating lyric angles range from zero to plus/minus 40 degrees; a wider fitted text block measures horizontal as well as vertical bounds. These changes do not alter native DSP, consumption confirmation or source audio. Replacing a longer playback selection with a shorter one now publishes its metadata and first confirmed native state in one Solid batch: queue consumers never see the new titles paired with the previous occurrence indices. A regression first reproduces the actual QueueLyrics consumer exception that prevented footer refresh after audio had switched. Stop retains the last confirmed queue order; a row can restart that order at its chosen occurrence without a stale native jump. Account/source reset clears retained rows, including when the stopped native reference is empty. Native acceptance is recorded separately.

Portable preferences V2 include the selected account's private podcast subscriptions/listened evidence and saved articles. An explicit import preview identifies provenance, destination and counts. Restore adds absent identities, retains existing records and validates both stores' complete publication budgets before starting. V1 anonymous preference files remain valid; unassigned legacy device records are untouched. See [managed local engine](local-engine.md) for file limits, native session admission and the two-file IO publication limit.

The import feasibility discussion for other applications does not introduce an importer in this milestone.

## Playback presentation controls

The queue reserves equal 24-pixel top/right/bottom margins and fills its available grid row. Only its ordered entries scroll. The compact row places the drag grip, album-relative track number, 20-pixel lyrics glyph and title in that order. A retained lyrics glyph is white and non-interactive; an unavailable glyph is muted and retains the existing explicit acquisition action. Clicking a number or the rest of the row starts that exact occurrence; action and readonly lyrics clicks never bubble into playback.

The ordinary lyrics control is a view-session switch. Hiding it preserves the resident paragraph and its dragged position, skips hidden fitting work and hides untimed-text controls. The floating scene remains independently selectable and can still render its words. Account/settings replacement restores the ordinary visible default. No new account preference or portable-backup field is introduced.

A separate resident SVG layer follows the pointer over the complete-track waveform and maps the same full-width coordinates as click seeking. Consumed-clock updates do not invalidate the pointer target. Leaving, canceling, blurring, replacing the track or disabling seek clears it. It never moves the consumed clock or refetches the retained envelope. Idle timelines remain unavailable. Shared notification dismissal explicitly overrides margins from surrounding forms and centers its close glyph beside wrapped text.

The cover-size control precedes the catalogue toolbar spacer at its far left, with a resize-frame glyph and accessible size/reset tooltip. Its bounds, session state, double-click restoration and Cover Flow disabling remain unchanged; no Cover Flow renderer or transition code changes in this refinement.

## Retained queue and optional lyric loading

A closed drawer can reopen after Stop whenever retained queue entries exist, independently of the active-track header. Native queue order updates reuse the same occurrence objects so keyed rows survive a Jump. Optional lyric resources read their latest guarded result without registering the workspace Suspense: an initial read, track replacement or completed download cannot collapse the scrolled queue or replace the whole playback view with a loader. Account/reference guards still reject stale words. The ordinary lyric stage retains its own height even without a decorative canvas or frequencies. Completed legacy Server jobs without the optional source field refresh active lyrics using the canonical Server default.

A fixed square ActivityGlyph is shared by individual and bulk lyric downloads. Pointer hover or keyboard focus reveals Stop without changing dimensions; other exports remain disabled while busy. Stop forwards the captured task ID and source only for the still-current authenticated owner, including cancellation before task submission acknowledgement. Terminal tasks are retired before the next entry. Closing the drawer still leaves library-owned acquisition running; owner replacement prevents late cancellation or result publication under a new account.

## Explicit cover sizing and stable transport geometry

CoverSize displays the chosen pixel value to the right of its native range. The leading resize-frame button restores 150 px on pointer double-click or keyboard activation; a single pointer click leaves the selection intact. The range itself retains double-click restoration. Both controls are disabled during Cover Flow, whose renderer and transitions are unchanged. A fixed-width, tabular output avoids toolbar movement between values.

PlayerTransport owns the shared 38-pixel control row and 28-pixel waveform/live row. The footer retains an 80-pixel footprint across music, podcasts and radio; metadata and a stream error cannot resize it. Radio status occupies the same reserved row as a finite waveform. Errors remain accessible and reveal complete text through the title without moving the transport or artwork. RadioPlayerBarView is the actual props-only radio presentation; RadioPlayerBar retains its existing owner-bound media controller.

The development-only explorer includes real presentation surfaces for these contracts and an exhaustive module inventory. It serves only the explicitly mapped public country boundaries in addition to its own assets; no provider, account or native capability is imported. The fixture footers use the same PlayerTransport implementation as the app. Browser geometry acceptance does not establish audio-stream or cross-platform native acceptance.

CountryGlobe accepts an optional typed, readonly geometry loader, forwarded by CountryExplorer. The app retains its existing bundled-asset loader. Explorer fixtures inject that exact public geometry without replacing global fetch; this also works when an already-running explorer has not reloaded asset middleware. The development server additionally admits only GET/HEAD for the exact country-boundary path, with a regression rejecting traversal and other methods; the general public directory remains unpublished.

## Personal layout and optional reads

Favorites, rated albums, tags, moods, collections and history share the selection header boundary; account access notices follow that boundary with one common margin. A selected M3U uses non-suspending resource snapshots with explicit initial values, guarded by the captured source/account/selection. Its loading indicator belongs to the positioned content pane, leaving the file list mounted and scrollable.

The globe panel and its descendants suppress text selection while retaining country selection, rotation and keyboard interaction. The globe panel has no border and its rectangular canvas has no focus outline. Canvas margins are inert for pointer picks/drags/zoom; keyboard focus is drawn on the sphere itself. Picking and interaction admission share the same radius computation.

Queue lyric downloads distinguish a bulk operation from an individual reference from admission onward. Only the actual bulk operation animates the batch control; the individual action remains cancellable while waiting for task admission. Its number is aligned with the title, with the lyric glyph underneath. Retained words remain white and unavailable acquisition remains muted. The hover/focus Stop uses a shared glyph whose visibility must not be overridden by queue-specific layout selectors.

Radio visibility tracks the fixed owning SVG viewport, never the changing path bounds. An interrupted optional sampler clears the same resident buffer and draws the idle wave for that frame, then retries on the next frame. Visibility and document hiding still suspend the draw loop; these changes do not promise analyzable audio for non-CORS or unsupported HLS stations.

## Reviewed imports and transport feedback (2026-10-12)

Settings adds the [Roon album-export review](player-imports.md), with explicit private-field mapping and source/account capture. Unknown Audirvana/Tune personal export formats remain disabled. Podcast subscription uses the shared ActionButton activity in place; the radio failure explanation wraps in an overlay above the fixed footer, including narrow layouts, rather than truncating or shifting controls. Queue original-order restoration sorts stable logical occurrence indices; it preserves repeated track references, multiple album numbering and the active audio occurrence. Original-order restoration is the first queue action, followed by alphabetical sort, reversal, lyrics and the save controls.

## Shared controls and lyric presentation (2026-10-12)

The props-only RSS form owns empty-input admission and shares ActionButton with the rest of the interface. Leading-icon actions compensate for internal SVG whitespace without changing their request-time geometry. Tags and rated albums use the same wrapping selection row, with the count, filters and trailing collection action. Header padding and the following content gap belong to StickyHeader; tag choices add no external margin. Floating lyrics render only their foreground words: the duplicate shadow layer, inherited text shadows and word extrusion are removed while entry, drift and foreground depth remain. These presentation changes do not alter account storage, queue occurrence policy or audio playback.

## Common result-view geometry and refresh admission

Result views reserve their header, access explanation and remaining-height empty state in one flex layout. Empty-state glyphs retain a 38-pixel box; nested saved-article panels participate in the same height contract. Personal and tool headers share separator padding; an empty History header hides only the separator paint while retaining its dimensions. Reset remains at the start of its action row. Podcast access notices follow the subscription controls; Advanced Search explains missing account access before its form.

InlineActionForm owns the common labeled-input/trailing-action layout, used by the real RSS subscription and Wikipedia search forms. Minimum height comes from the shared form-control token. ChoiceChips presents country and genre selection with compact pills, a reserved check marker and readable selected/hover colors. Country modifier selection remains union/toggle behavior; no globe projection or Cover Flow rendering is changed.

RefreshButton is controlled by its caller, sharing the fixed activity glyph and hover/focus Stop with downloads. Diagnostic reads retain confirmations for the exact source scope. Cancel retires presentation admission, preventing a late result or error from replacing that confirmation; it does not interrupt an already dispatched native IPC request. Explicit retries cannot overlap while that request remains pending. Compound trophy reads also check admission before starting an unlock write. Coverage checks admission between status and result retrieval. Account/source replacement and disposal invalidate admission. Native transport abortion remains a separate contract.

Album-detail M3U actions sit beside the bottom analysis exports, using the existing authenticated M3U contract. The footer artist name links to the exact known album-artist identity; unknown associations stay text. Concert navigation uses a microphone glyph.

## Collection playback and expanding selection chips

ChoiceChips mounts the check marker only while selected. Unselected pills keep equal left/right padding; selected pills grow by the marker width and gap. The shared country modifier and keyboard policies remain unchanged.

The last action in every collection list row is explicit Play. It reads the latest saved expression from the captured private account, then evaluates it with Aède's owner-scoped search in complete 50-row windows. The queue retains Aède's result order and exact matching track membership; it never widens a selected track into its full album. Catalog epoch, total count, unique identities, source qualifiers and retained album-relative positions are validated before audio admission. Empty, oversized (over 4096), changed or incomplete selections are visible errors. No selection or rule is saved to public caches.

Delayed selection preparation shares the player's busy/generation lifecycle. Pending source ownership remains explicit until completion, allowing logout/reset to retire the read before audio starts. Competing start controls are disabled while preparing. Existing music and consumed-position polling continue during this read; only actual audio admission replaces their generation. Canceled preparation leaves the preceding stream and its polling intact. Leaving the collection view cancels publication admission without starting another request. The native audio engine and original files are unchanged.

## Personal catalog actions and explicit legacy-cache recovery

CatalogActions owns reverse/list/optional Cover Flow order and the final collection slot. Catalog and personal headers use one 8-pixel control gap; dense track/collection rows use a 4-pixel gap. Favorites reuse the existing Cover Flow renderer and exclude simultaneous compact presentation. Rated albums reverse their existing rating order; Tags reverse the complete matched-entry order before pagination. Their compact presentation stays independent of the ordinary catalog's density. Collection visibility is a real closed/open eye toggle, preceding Delete and final Play; duration comes only from Aède's exact owner-rule aggregate and remains unknown on old servers or incomplete duration metadata.

An explicit Tracks repair now synchronizes a connected source instead of reopening the same incomplete legacy track cache. For a managed local source it may explicitly reconnect the existing local engine; remote repair requires its account connection. The shared error feedback describes missing cached rows without an Error prefix. Unresolved cache faults remain visible until dismissal or recovery; errors share a distinct error-color border, independent from selected-control accent. A header activity control remains mounted while snapshots change. Cancellation retires presentation admission; the already dispatched synchronization may finish and update the public cache. No implicit synchronization occurs merely by opening Tracks.

M3U inventory and content reads share diagnostic admission. Refresh keeps confirmations/selection visible; hover/focus Stop retires both read admissions, ignores late replies and prevents overlapping explicit retries while IPC remains pending. Initial loading stays inline so the action remains reachable. Analysis pagination uses accessible arrow actions and bottom breathing space.

## Coherent statistics activity and atmosphere counters

Statistics waits for both aggregate and diagnostic reads behind one central PageLoader, using the shared Refresh as an immediate Stop without a second spinner. Its first table pages are synchronous projections of the confirmed report; only explicit nonzero table pages perform asynchronous reads. Cancellation retains the read-admission limits described above. ResultCount keeps its shared font size inside page headings, including Ambiances. Once a recipe is selected its header count represents matching tracks, rather than the number of recipe cards. Optional atmosphere evidence scopes explain specific personal tags while older server responses remain readable.

## Statistics navigation and shared tool presentation (2026-10-14)

Country/region statistics prepare a clean Countries selection before following the internal link. Parsed snapshots retain the original MusicBrainz area alongside the display country; matching area or ISO-derived English country names select the corresponding display-country values, without confusing an untranslated label with a French facet. Canonical numeric decade buckets open the inclusive ten-year album interval without stale query, alphabet, genre or country facets. Undated and malformed labels remain text rather than fabricating a range. The same row contract preserves artist links and independently paginated tables.

Leading header summaries share 12-pixel muted text and zero block margins across personal/tool layouts, including Concerts, Trophies and Statistics. CoverSize's reset glyph uses the ordinary text color at rest while retaining hover accent, disabled feedback and reset behavior. Unknown collection duration aggregates render no placeholder; confirmed zero remains a real clock.

External-player discovery uses a props-only PlayersContent surface, with one page-centred Loader for initial discovery and Refresh even when a preceding volume list exists. The header remains reachable as Stop without another spinner. Cancel reveals the retained confirmation/selection under the existing guarded-read contract; it does not claim native IPC abortion. Storybook exercises the real surface with fictional mounted volumes.

## Session actions, fixed tracks and album M3U (2026-10-14)

Connected-server Logout stays available during library synchronization; only its own pending logout disables it. Shared ActionButton owns icon/text/activity geometry. Clearing the server account, connection monitor and server-private annotation projection is batched before native revocation, while the local source remains independent.

Tool-header summaries and result counts share one `--header-summary-size` token, taking Tags as the reference. Inner action rows have zero block margins and the common control gap, restoring the Statistics separator's normal 61-pixel single-row geometry. Tracks keeps a bounded independent result scroller below its fixed header; pagination uses icon actions and the page-size control is below the results.

Album M3U creation/download actions stay visible at the right of Pistes, apart from JSON analysis export. A metadata-only, captured-owner lookup of the canonical Aède CLI album file disables redundant creation and enables exact existing-file download. Failed/unsupported lookup is unknown, never a claim of absence. Older servers need the additive `album_m3u_lookup` capability. Saved metadata and feedback retire on account/reference replacement. Actual download feedback renders below the heading rather than widening or wrapping its action row.

## Shared pagination and result geometry — 2026-10-14

Tracks, Diagnostic, Analysis and M3U use a props-only Pagination component: identical back/forward icons, 36-pixel targets, eight-pixel gaps and lower breathing room. Existing read/page-size rules stay in their view controllers. TracksHeader puts page size at the leading edge with Refresh beside it; paging stays below the independent result scroller, whose scrollbar is separated from row content. Diagnostic and Trophies keep intrinsic content height so their lower padding is actually reachable. Labels uses the shared sticky separator. MoodFeatures places extraction/Stop beside its heading, with coverage below. Album and Track hero facts align at the top of their artwork. No playback, Cover Flow, provider, Rust or dependency changes.

## Library generations and private listening — 2026-10-14

Settings > Aède presents four explicit whole-source derivative actions and one ordered background plan. Each accepted plan is owned by the engine, survives view closure, retains task identity after recovery and refuses parallel administrative admission. Captured source/account checks guard submissions and tracking; a lost POST response triggers registry recovery, never blind replay. Account roles and advertised capabilities control availability. Only the three latest terminal generation results are shown. Audio workers are bounded to one; original audio and tags stay unchanged. Library-folder M3Us remain shared catalog derivatives, independent of private saved exports.

Album listening is read only in Albums, including its unchanged Cover Flow window and list/grid artwork. Unknown/disconnected sources have no red marker. Owner-private results remain outside public catalog caches, retire immediately on owner/view changes, and use a 16 MiB conservative presentation budget. Stable transport/catalog checkpoints refresh evidence without reacting to clock, level or volume ticks. Complete evidence removes the pointer-inert corner marker; other album presentations do not receive it. Aède's all-time counters, paged personal endpoint and CLI glyph are authoritative. Legacy evicted listens cannot be reconstructed; this is retained software evidence, not physical-audibility certification.

Shared spacing tokens centralize the sixteen-pixel pagination gap, twenty-four-pixel page end and six-pixel detail-title inset. Diagnostic list margins no longer accumulate before paging; Analysis owns its intrinsic end padding, while M3U/Tracks reserve the same compact lower space in their bounded scrollers.

## Component versions and explicit album decoding — 2026-10-14

Settings > About shows the native app version and linked Aède/FlacCompagnon Core versions reported by each connected engine. Older servers remain explicitly unknown, not inferred from the app version; disconnected engines are labelled unavailable. Product links use the existing bounded external-link bridge. Source/account-captured requests cannot admit another owner's late result. Folder tabs retain space beneath text for native scrollbars but have reduced vertical padding.

Album integrity starts a fresh server-owned full decode task for the exact edition placements. It prefers an available flac executable on the engine host and otherwise reuses Aède's existing decoder; audio/tag files and stored CRC/analysis reports remain unchanged. The shared action shows busy state and keeps a reachable Stop; authenticated results persist in the root task controller across view navigation. A new protected capability/route requires updating external engines.

## Embedded About and artist presentations (2026-10-14)

About displays Phémios and the versions queried from the exact embedded Aède executable during preparation, without starting an engine or accessing a catalogue. The unpublished Phémios website has no link. The two published product websites remain explicit; a connected remote server reports its own distinct component versions. The final row has no separator.

Artists offers three always-available mutually selected presentations: immersive portraits, discography cards and editorial rows. The choice joins the existing owner-scoped, synchronized and backed-up tool preferences. Existing stores migrate to discography cards. Cards use only resident artist media and cover URLs. Artist Play remains the principal chronological discography, independent of the illustration. Mini Cover Flow reuses the established bounded scene and input policy, includes every principal release with unknown dates last, and keeps a session position for each artist. One shared viewport observer suspends offscreen scenes; catalogue changes retire unused positions. Album Cover Flow behavior and country presentation stay unchanged.

Acoustic decoding in Aède no longer monopolizes the shared writer lock. Album publication reloads the latest protected catalogue under its short guard and merges measurements, preserving intervening writes. Account authentication still revalidates credential revisions before publishing a session. Server-owned jobs survive client closure; an already-running older server needs a restart to use the corrected worker.

## Full-height artist posters and large editorial rows (2026-10-14)

The retained `discography` preference now selects artist posters without a carousel; no preference migration loses an existing choice. Posters derive their row height from the actual remaining content container below the sticky controls. A minimum height keeps the two featured albums readable in short windows. The existing immersive portrait presentation stays intact. Editorial rows give the artist image and visible album squares the full row height, reducing the number of previews at narrow container sizes.

Featured albums use only the current owner's positive ratings, favourites to resolve equal ratings, then available covers and chronological ties. Without ratings, available covers take priority; no second release is fabricated. Account logout removes the annotated ranking through the existing cleared private projection. Posters use existing backgrounds when available and expose resident logo art in the upper-left corner. The public Aède media projection adds optional logo presence, and the bounded artwork route/bridge supports the same confined artist assets with 512-pixel logo responses. No external enrichment or original-media changes occur.

About shows only Phémios and the embedded Aède/FlacCompagnon Core versions. Connecting a local or remote account performs no additional version request or adds a product row.

## Vertical large-format artist cards (2026-10-14)

The large-format presentation follows the supplied portrait composition: responsive narrower columns, a tall minimum aspect ratio and the remaining viewport as a minimum row height. Short windows keep a separate result scroller rather than stretching cards sideways. Explicit full column width prevents intrinsic aspect sizing from creating empty inter-column space. Portraits take precedence over backgrounds, with the same resident-media fallback chain. Two cover slots share the useful bottom width equally with one fixed gap, without the old pixel cap or extra caption rows. Album titles remain accessible through their existing labels/tooltips. A single-album artist retains one half-width slot.

The logo stays upper-left, and the persistent round artist Play sits beside the identity above the albums. It retains the original chronological principal-discography command; cover overlays retain their existing independent album commands. Private featured-album ranking, immersive portraits and editorial rows remain unchanged. No dependency, enrichment, audio pipeline or source file changes.

## Available-height artist rows and monochrome logos (2026-10-14)

Artists starts with both rails hidden, while other catalogue defaults and explicit per-view session choices remain unchanged. Large-format rows now take exactly the result viewport height, with native mandatory vertical scroll snapping and one-row stops; the fixed grid gap separates successive rows. Resizing or toggling rails recalculates row height through the existing CSS size container. Cover slots keep their equal width but cap against row height in short windows. No wheel interception, animation frame loop or new dependency is used.

Resident artist logos retain their original alpha, internal contrast and bytes, with a brighter grayscale presentation in the upper-left corner. Solid recolouring is deliberately avoided because textured logos lose their lettering when reduced to an alpha silhouette. Older server snapshots have no logo-presence hint: the external Aède service must run the logo-capable build and explicitly synchronize before those assets can be warmed. No external enrichment is started and no original picture is rewritten.

## Artist selector consolidation and legacy logo recovery (2026-10-14)

Artists retains cards and editorial rows. The former immersive portrait icon now identifies cards, and legacy `portrait` preferences migrate to `discography` without discarding the remaining owner settings. Retired portrait CSS, icon artwork and translation are removed. Card logos use grayscale only, preserving source contrast, alpha and bytes without whitening or brightness compensation. Artist Play keeps the existing principal chronological discography command; the user confirmed its playback was working.

An absent public logo hint remains unknown rather than becoming false. Explicit false hints still avoid requests. One shared viewport observer admits unknown-logo cards only while connected and near the visible result area; a serial recovery policy coalesces attempts per source session/snapshot, excludes retained images/errors, discards obsolete queued scopes and stops after gallery disposal. It reads only existing protected Aède artwork, never starts external enrichment and requires a logo-capable server for a successful response. Normal offline browsing stays network-free. Known logo hints retain the ordinary artwork warming path.

The migration and legacy hint tests first fail against the prior behavior. Four additional policy tests cover offline/cache admission, serial/offscreen reads, source replacement/disposal and explicit failure continuation. Storybook covers the two selectable icons, grayscale presentation and the actual artist Play pointer/hit target. Native acceptance is recorded separately.

## Editorial artist reference and stable Play glyphs (2026-10-15)

Artist lists follow the supplied horizontal composition: a full-height wide photo occupies the leading third, the identity sits centrally, up to three chronological owned-release squares align at the trailing side, and the shared rectangular Play action stays last. Container-relative row sizing keeps the photo broad rather than square; narrower containers reduce visible previews before sacrificing identity or Play. The two existing artist selectors and saved presentation remain unchanged. Artist name and border use the identical accent for whole-card hover or keyboard focus; metadata keeps its muted colour.

The actual shared CoverPlayView retains the triangle throughout a pending request, with no spinner. It preserves source/account admission through its native wrapper, independent detail/cover navigation and guarded single-request admission. The asynchronous request itself and its error reporting remain with the existing player. No music pipeline, Album Cover Flow, dependency or source artwork/audio changes occur. The wide-row geometry and deferred-Play stories initially fail against the old behavior, then pass with the revised presentation; native acceptance is recorded separately.

## Panoramic artist-list artwork (2026-10-15)

Editorial artist rows prefer a resident background over the portrait, fitting their panoramic photo area. Without a resident background, the existing portrait/banner/album fallback remains available. Large-format cards keep their portrait-first order. The shared pure selection policy only reads the existing image store, reacts to a background becoming available and performs no enrichment, image rewriting or new network request. Existing framing and asset-size limits are unchanged.

## Recent navigation and transient album checks (2026-10-15)

Nouveautés is the first default library entry. Version-6 navigation migrates only the former standard library sequence, preserving custom order, hidden entries and labels. An empty rolling-month selection temporarily hides the entry without altering saved navigation. A shared one-minute clock drives both menu admission and the mounted recent page; other catalog filters do not hide this navigation entry. The coherent navigation migration module remains together above the usual line-count target so each version preserves the preceding menu contracts.

Album integrity occupies the first compact action beside Pistes, before the permanent M3U actions. It requests the captured source’s exact catalogued album through Aède’s `album_decode_results` capability. Unsupported older engines fail visibly before submission. The server owns accepted tasks; the mounted page owns only its explicitly started task’s visible verdicts. Leaving the album, replacing the source/account or reopening the page clears those verdicts. No download or persisted result UI is provided.

Strict version-1 results must cover each current exact file once. Truncated, missing, foreign, duplicate, unknown or exit-inconsistent reports never become green verdicts. A green check means a verified reference digest; a red cross means decode/verification failure; a neutral dash means complete decoding without a reference digest. All three verdicts occupy the same centred 16px slot so track titles remain aligned. The accessible label and tooltip retain the explicit no-reference explanation. Original audio, tags, cached CRC conclusions and analysis reports remain unchanged. Test action activity uses the existing cancellable spinner/Stop presentation.

Only a failed badge with a disclosure callback becomes a native button, retaining its 16px slot and an explicit stacking layer above the track’s full-row link. The current result’s message opens below the row as literal multiline text; success/no-reference states remain readonly. The disclosure is tied to the exact failed verdict object, so a fresh result or cleared report closes it. A second click, Close or Escape hides it; Close/Escape restore focus to the badge. No report download or additional network request is introduced. Aède supplies bounded external-verifier diagnostics through the existing message field.
