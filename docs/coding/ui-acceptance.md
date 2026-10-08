# Initial UI acceptance

Manual checks on 2026-10-08 use the bundled fictional catalog. They establish interaction behavior on this Mac, not physical audio, transfer acceptance, large-catalog performance or accessibility compliance.

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
