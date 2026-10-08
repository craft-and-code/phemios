# UI acceptance record

Initial checks on 2026-10-08 use the bundled fictional catalog. They establish interaction behavior on this Mac, not physical audio, transfer acceptance, large-catalog performance or accessibility compliance.

## Browser preview

- Change year bounds to 2000–2015. Moving the band one step right yields 2001–2016; dragging it further retains the 15-year span.
- Select L–O in the alphabet, move left to K–N, then drag right to L–O. Artist results follow the initials while the year rail remains active.
- Switch to alphabet only, then back to both. The hidden year rail is inactive in alphabet-only mode. Reset restores the catalog's actual 1974–2023 domain, all initials, missing years and the empty query.
- Open Orée, then Les heures bleues. Artist banner/background are local assets; album detail is a full page. Rating, favourite, tags and notes accept temporary input with an explicit loss-on-exit message.
- Hide and restore the sidebar. The detail page and footer remain available.
- Choose unknown origin in Countries: Émile Varenne remains visible, without assigning an invented country.
- Open External players: connected actions are unavailable and no transfer can run. Conversion options are illustrative.

## Regression: artist participations

Before correction, selecting the single year 2013 on Orée's page left the 2020 compilation Rencontres visible. After correction, both discography and participations use the same album filters: Rencontres disappears for 2013 and is eligible for 2020. An unknown-year release remains only when the separate unknown-year option is enabled. Rechecked in the browser after correction.

## Native macOS bundle

- Launch the packaged release app with no Vite/server dependency. The status reads Application desktop, proving the native runtime command returned successfully.
- Inspect year/alphabet ranges, the artist list and optional artist artwork under the unchanged restrictive CSP.
- Click the 2003 tick, focus the selected band and press Right: the interval becomes 2004–2004. Reset and open Orée.
- Reopen the final bundle after stopping Vite: native status and artwork still work. Select 2013 on Orée's page; the 2020 participation is absent. Reset, return to artists and enable compact density: all four artist covers remain present.

The locally generated app bundle is a development deliverable, not a signed/notarized distribution. Minimum Rust-version execution, Windows/Linux, assistive-technology acceptance, warm/cold artwork cache and sustained fast scrolling remain separate checks.

## Correction and native integration acceptance

Browser checks subsequently verified selected-genre hover contrast, full search focus border and the futuristic globe with keyboard rotation. Histogram, real compact rows and the globe have separate commits. Earlier temporary annotation behavior describes only the foundation; current annotations require a native account and explicit server save.

Native acceptance completed after unlock on 2026-10-08 against the isolated real catalog (454 artists, 113 albums). Multiple older app processes had the same bundle identifier. To target the final binary unambiguously, a temporary validation copy used a distinct macOS Info.plist display name/identifier; executable and WebView resources were unchanged. The deliverable retains the original production identifier.

- Restart without a session: public cached titles and readable artwork load offline; no credentials or private annotations are restored. Login via the native form, synchronize the full catalog and verify real artwork. The public cache probe reads 148 of 152 advertised media files. The remaining two covers and two backgrounds return HTTP 409 from Aède's guarded renderer; these failures stay visible and are not treated as successful images. The progress numerator counts completed attempts.
- Inspect the country globe in the WebView, zoom in, select Switzerland and enable compact rows: the result count becomes three sourced artists. Earlier browser checks cover globe rotation and histogram dragging. The native globe and filtered distributions use the actual catalog, without remote map requests.
- Open the isolated copied album: its stored favourite, tags, note and existing analysis/spectrum load. A first failing acceptance exposed detail remounts and a draft reset after save. Stable non-keyed detail composition plus an annotation-only tracked effect/resource mutation correct this. Select four stars, save, observe the acknowledgement and retained selection, leave and reopen: four stars, favourite, tag and note are restored from Aède.
- Launch FlacCompagnon and spectrum generation from this album only. Native task status progresses to completed for both; the track result refreshes and its actual spectrum renders directly. The automated test also verified exit codes and unchanged original/copied audio hashes. Real cancellation races and disconnect/reconnect task recovery remain separate acceptance work.
- Open the saved server M3U and choose Download. The native app acknowledges its path under Downloads/Phémios; filesystem inspection proves exact byte equality with the private server file. Native publication uses collision-safe filenames rather than an unsupported WebView Blob download.
- Open Relations, select a local collaboration neighbour and confirm the graph centre and neighbour list update. Edges show catalog credit provenance and shared-track weights; they do not invent band membership.

Saved screenshots outside the repository show the native globe, filtered rails and actual spectrum. These host checks do not establish sustained fast-scroll frame rate, bounded decoded memory, other platforms, physical audio or external-player copying. Offline cache reuse, annotation draft stability, native M3U publication and bounded read retries have dedicated behavioral/native regression evidence; the remaining checklist stays in the roadmap.

The isolated automated integration additionally verified successful FlacCompagnon and spectrum tasks, existing-result reads, served PNG, annotation/collection/M3U persistence and unchanged source/copied audio hashes. Credentials and identifying library metadata stay outside documentation.

## Browsing, notes and statistics refinements

The updated macOS bundle starts with years enabled and alphabet disabled. Disabling the last visible rail leaves both hidden; enabling alphabet independently restores only that rail. Canonical album-artist browsing exposes 19 principal artists in the isolated catalog while keeping all 454 credited identities available in the graph/credits. All 113 albums have a year, so the unknown-date checkbox is absent; the fictional browser catalog exposes the explanatory “Inclure les dates inconnues” option when relevant.

Native connection-field focus follows the complete rounded edge. Clicking outside closes the dialog. Browser keyboard checks verify a full account-field border, Escape dismissal and focus restoration. Browser country buttons verify France, Command-click Belgium (union of three artists), then Command-click France (only Belgium remains). Platform modifier policy is also unit-tested; Windows/Linux native input is not verified.

Milkdown renders the compact star/heart controls and formatting toolbar in the native WebView under the unchanged CSP. An isolated browser fixture verifies that saving an untouched `__Original__` note preserves its bytes and that an immediate bold save produces a strong element and CommonMark source. A failing native rapid-save check first exposed the listener debounce; save now reads the current document directly. Final native acceptance types a note with bold enabled and immediately saves; a server read confirms the exact bold Markdown. Leaving/reopening restores visual bold; changing only rating/favourite preserves the exact note bytes. A native screenshot also exposed inherited accent hover text on the primary accent background; primary actions now keep their dark foreground. Temporary fixture files are removed before the gate. Private test annotations remain on the isolated server only.

The native Statistics page reads real totals: 113 albums, 8 compilations, 1,357 tracks/files, 19 principal artists and 454 credited identities, with duration, bytes and metadata coverage. Codec, quality, sample-rate, decade, origin and credit-role breakdowns display saved server facts. Artist ranking pagination advances from 1–50 to 51–100 of 182 while the writers remain 1–50 of 292. Read-only doctor totals match the server. Server measurements are not fabricated in offline mode. Page navigation now resets content scroll to the top. The final gate passes 8 Node tooling tests, 41 TypeScript tests and 14 independent core Rust tests, plus build, lint, formatting, Clippy and Rustdoc; the final host bundle builds successfully.

## Development launch and compact rating regression

A leftover agent-owned Vite process on 1420 reproduced the reported startup collision and was stopped. The npm Tauri launcher now binds Vite before invoking the native CLI, injects the actual bound URL, disables a second frontend command and closes its owned Vite server on interruption/CLI exit. A controlled occupied-port regression verifies both automatic selection and the shared URL; an explicitly pinned busy port fails visibly. Runner/application arguments keep their separator boundaries. The development command reaches the native executable; stopping that command leaves no listener on 1420. Port 1420 is a single default development preference, overridable with `PHEMIOS_DEV_PORT`; the release app uses no Vite server.

The star row now uses 14 px horizontal hit areas with 18 px glyphs, whose painted edges overlap slightly. The hit areas remain separate and keyboard focus stays visible. Native acceptance on the isolated account verified the same selected-rating activation policy shared by artist/album pages: selecting four lights four; activating four again clears the rating. Explicit save persists `rating: null` on Aède and retains the existing note exactly. The authoritative gate passes 11 Node tooling tests, 41 TypeScript tests and 14 independent core Rust tests; the updated macOS bundle builds.

## Immediate annotations and detail headers (2026-10-08)

A separate macOS bundle identifier isolates this acceptance cache/session from the normal app. The real-catalog test server remains on its existing isolated data directory. The compact translucent artist header has its return link aligned with the toolbar at the far right; biography is before annotations, and the album return follows the same shared toolbar. No original audio or personal account data is changed.

Native editing of an unsaved note and tag followed by rating/favourite activations proves that only the icon fields reach Aède; exact saved note bytes and tags remain unchanged. The draft remains visible. Explicit notes/tags save then preserves the confirmed icons. Rapid selected-rating activations finish cleared in both UI and user storage. Album icon-only changes survive reopening, and the ordinary album CLI against the test data prints four stars and a heart without an explicit save click.

An initial acceptance found a repeated private-read loop when a fresh scope object followed annotation-driven artist projections. A failing client-runtime regression reproduces the repeated fetch, and stable primitive reference/session dependencies fix it. Final native controls remain enabled after reads and writes. Vitest uses Solid’s client runtime so reactive resource behavior is actually exercised.

A brief process pause with automatic resume on the isolated server makes the connection label/dot turn red; after resume a subsequent authenticated probe restores the green heartbeat without re-login or loss of displayed annotations. Screenshots of the artist toolbar, persisted album icons and disconnected state are saved outside version control. The complete gate passes with 11 Node, 48 TypeScript and 15 core Rust tests, warning-free lint/docs and native executable compilation. macOS host bundling passes; this does not establish Windows/Linux or physical output/copy acceptance.

## Blurred headers, cover preview and scoped analysis downloads (2026-10-08)

The shared return link now sits at the toolbar’s far left, vertically centered with the right controls. Native inspection shows a blurred translucent artist banner with sharp text and biography before discography. An album cover opens large in a modal; Escape and a click outside close it. The trigger explicitly receives focus on opening, including macOS pointer activation. Saved screenshots show the banner, cover preview and real analysis graphs.

The isolated server uses the newly built Aède export endpoint. Native track charts display retained loudness, dynamic range, peak, bit-depth, cutoff and stereo measurements. Album and single-track buttons successfully publish JSON under Downloads/Phémios. Filesystem verification confirms eleven album entries versus one selected entry; the latter equals the corresponding album entry and exact retained source JSON. Core/server regressions cover extracting a track, assembling an album, current-file validation, missing/legacy/unsupported reports, original paths after catalog moves, deduplication and size limits. No source audio is analyzed or changed by a download.

The reported real-account mismatch was inspected read-only: the saved rating/favourite target is an artist, and the artist CLI shows both. Album annotations are separate, with no inherited rating. Page headings and save acknowledgements now identify the scope. Two older normal app processes and the original server remained running during acceptance; they require restart to load new code. The acceptance app uses a separate bundle identifier/cache and the isolated server.

The authoritative Phémios gate passes with 11 Node tooling tests, 51 TypeScript tests and 17 independent core Rust tests, plus format/lint/build, Clippy, Rustdoc and native executable compilation. The Aède authoritative gate also passes. Native host bundling is verified on macOS; Windows/Linux and physical audio/copy acceptance remain pending.
