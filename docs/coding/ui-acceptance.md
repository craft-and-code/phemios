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
