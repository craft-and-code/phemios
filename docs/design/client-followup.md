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

The props-only RSS form owns empty-input admission and shares ActionButton with the rest of the interface. Leading-icon actions compensate for internal SVG whitespace without changing their request-time geometry. Tags reuse the same personal-header bottom gap rather than adding another choice-row margin. Floating lyrics render only their foreground words: the duplicate shadow layer, inherited text shadows and word extrusion are removed while entry, drift and foreground depth remain. These presentation changes do not alter account storage, queue occurrence policy or audio playback.
