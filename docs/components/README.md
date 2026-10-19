# Phémios component explorer

This development-only Storybook mounts the actual SolidJS presentation components and application CSS. It is separate from the Tauri entry point and native application bundle. Scenarios use fictional values and in-memory callbacks; they do not load accounts, request services, play audio, invoke Tauri or write downloaded files.

## Run and build

From the repository root, run `npm run components:dev`, then open `http://127.0.0.1:6006`. The listener is loopback-only, opens no browser automatically and refuses an occupied port. Storybook telemetry and version checks are disabled. Stop it with Ctrl+C.

`npm run components:check` applies the application's strict TypeScript rules and builds the separate static explorer into `dist-docs/components/`. That check is part of `tools/check.sh`. `npm run components:build` only creates the static output. Nothing under this directory is imported by the production application. The ordinary unit suites remain authoritative for controller, account and native policy behavior.

## Explore real states

The Controls panel edits component props. Stateful scenarios retain their own in-memory values and expose a readout; changing Controls updates those values. The language toolbar applies FR/EN only within this browser preview and never saves a preference.

The explorer imports the real presentation components listed in the coverage inventory. Controls include cover sizing, histogram rails, filters, rich notes, radio search and role help; status primitives include loaders, empty results, counts, downloads and dismissible feedback. Data scenarios include adaptive statistic values, integrity evidence, analysis charts and paginated tables. Media scenarios include the real globe/country explorer, relation graph, particle scenes, 24 frequency bands, radio wave and fixed footer presentation.

The [complete component inventory](coverage.md) records component coverage, including account/native wrappers that are not yet standalone scenarios. Coverage is explicit: showing a primitive inside a wrapper does not establish acceptance of the connected workflow. These remaining surfaces need typed presentation props before they can enter the explorer without a real account.

Authored `play` scenarios exercise feedback dismissal; pointer, keyboard and disabled cover-size reset; Enter-versus-comma/backspace tags; download success/cancellation/Stop hover; radio footer geometry; Enter submission; histogram keyboard movement; asynchronous table pagination, bundled globe boundary loading, individual lyric Stop and recovery from a transient radio sampler failure restoration of the account cover-size default, in-button subscription activity and explicit personal-rating column mapping, empty RSS admission, shadow-free floating words and equal personal-header spacing, shared read cancellation, matching inline search controls, keyboard choice chips and equal empty-state placement across nested result layouts, plus shared catalog-action order, spacing and list/Cover Flow exclusivity, a single central statistics refresh and equal atmosphere/result counters, matching tool-header text, the normal cover-size reset color, filtered statistics navigation and mounted-player refresh/cancellation, fixed Tracks controls, logout during synchronization, permanent existence-gated M3U actions, and unsupported-iPod/ejection admission during transfers. They run when their stories open in Storybook; static compilation alone does not execute browser interactions.

The import-boundary plugin refuses the native platform layer, Tauri imports, LibraryProvider and application startup. The dedicated Vite configuration excludes environment files and public-directory discovery, apart from the existing fictional landscape referenced by the shared CSS and the explicitly mapped local country boundaries and exposes no prefixed environment values. The preview's content policy blocks external connections and media. A scenario requiring native data should first extract a typed presentation surface with explicit props, then use fictional fixtures here. Do not mount the full library provider or replace a real component with a copied imitation.

## Add a story

1. Add `stories/Component.stories.tsx`, importing its actual implementation from `src/components/`.
2. Describe its contracts and meaningful states with `Meta`/`StoryObj` from `storybook-solidjs-vite`. Keep fixtures under `fixtures/` and use local signals for controlled behavior.
3. Add a `play` function with `storybook/test` only for behavior that can be exercised without account, filesystem, audio or network operations. Keep failure, cancellation and stale-owner scenarios explicit where relevant.
4. Run `npm run components:check`, the affected behavioral tests, and inspect the story in a browser. Do not claim browser interaction acceptance from a static build.

The explorer uses pinned development dependencies. Solid support is community maintained; its adapter currently declares Vite 8 and Solid 1.9 compatibility. See [Solid Storybook integration](https://github.com/solidjs-community/storybook), [Vite builder](https://storybook.js.org/docs/builders/vite) and [interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing).

Shared Pagination supplies the same range and arrow controls to Tracks, Diagnostic, Analysis and M3U. Its scenario covers first/last-page admission, movement and common geometry. TracksHeader keeps the page-size selector and Refresh above the results, with Pagination below them; detail alignment, lower-page spacing and the MoodFeatures title/action axis have browser regressions.

The vertical ArtistCard gallery exercises two rows of three full-width columns, exact available-height cells, mandatory native row snapping, grayscale logos without brightness compensation and equal large bottom cover slots. Its single-card scenario checks actual cover width, the fixed gap and the artist Play pointer/hit target; native acceptance additionally checks short-window scrolling and retained resident portraits.

Editorial ArtistCard rows now exercise the wide-photo reference, three centred square covers, one reduced-width cover, retained Play placement and exact shared accent colour at focus. CoverPlayView holds its triangle during a deferred request, refuses overlapping starts and restores admission without a spinner. The native/account CoverPlay wrapper retains source and role validation.

AlbumIntegrity and TrackIntegrity isolate the transient full-decode action and the three noninteractive per-file verdicts. Stories cover fixed action geometry, Stop on hover and the explicit absence of a verdict before a fresh test. Account/source guards and strict structured-response admission are unit tested separately.

TrackIntegrityError exercises the actual inline failure disclosure with the whole-row track-link hit target. Pointer and keyboard open/close, Escape and focus return, literal multiline diagnostics, equal badge/title geometry and fresh-result reset are checked without any native or download action.

Media-row consistency is checked by `Controls/RowActions`: Tracks, analysis coverage, history, labels, collections and compact album rows share hit-area and glyph dimensions. `Media/PlaybackLyrics/ManualNavigation` checks the actual previous/next controls and retained words through an explicit same-track clock update; it does not play audio.

The compact follow-up adds complete/partial/unknown album duration scenarios, the real radio favourites/globe scrolling column and an individual lyric download that must not start playback. Radio timeout feedback is tested with its five-second, non-pausing lifetime; ordinary feedback keeps its existing readability policy.

`Foundation/StickyHeader/AccountVisibility` verifies zero header footprint and no accessible actions while disconnected, restoration after connection and removal after logout. `Media/Playlists/Disconnected` covers the dedicated workspace; `DisconnectedDrawer` preserves the independently usable Playback drawer. These presentation checks do not authenticate a native account.

`Media/DurationToggle` checks the inert dash/default pointer and unchanged finite-duration toggle. These scenarios neither mount a library provider nor invoke native capabilities.

Biography reading is exposed by `Catalog/ArtistBiography` (literal sections, contents/focus and attribution) and `Catalog/BiographyMore` (inline arrow/activity geometry). Public-cache/revalidation and account/native navigation admission are tested separately; these presentation scenarios do not fetch Wikipedia. `Media/TransferWorkspace` verifies picker-before-selection DOM order and equal scrolling panels, while `Media/QueueAdd/PagingHelp` exercises shared compact pagination through both bounds. `Media/TransferDestination/StableRefresh` checks retained card height with multiple devices and a cleared selection notice; `Catalog/ArtistBiography/LongReading` verifies the floating return and title focus.

The assembled [website and user manual](../../site/README.md) includes this same static explorer at `components/`, alongside Rustdoc and frontend declarations. `Editorial/WebsiteShowcase` renders the real collaboration graph and playback scene for editorial captures, using fictional credits and original placeholder words. These screenshot fixtures do not add native or account access; see [capture provenance](../../site/assets/screens/README.md).

`Catalog/BiographyMore/DuringArtistPlayback` reproduces the artist-page current-track/biography adjacency. Real hit testing ensures the playing-track link cannot intercept Read more; the catalogue track row retains its full-width click target. This scenario requires no account or audio playback.

`Data/AnalysisReport` exercises the reusable guided rendering, remembered expand/collapse controls and mouse/touch marker hints, compact shield block, aligned disclosure arrows, whole-album JSON selection, read-only import and literal diagnostics. `npm run analysis:build` exports the same renderer for non-Solid sites; see [integration and limits](../design/analysis-report.md).

AnalysisReport scenarios also verify the single rotating expansion control, green aggregate integrity only for confirmed good verdicts, mouse/touch and focus hint dismissal, and interactive click/dropout timing aligned with the complete chart width.
