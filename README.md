# Phémios

Phémios is the local-first desktop client for Aède, built with SolidJS, TypeScript and Tauri 2. It presents Aède's graph and capabilities without duplicating the engine or changing source music files.

## Start

Use Node.js 22.12+ within major 22, major 24 or 26+, and Rust 1.90+, plus the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/). The resolved Tauri crates declare Rust 1.90; builds here were verified with Rust 1.99. Execution on the minimum toolchain is still pending.

```sh
npm ci
npm run dev
npm run tauri dev
```

`npm run dev` serves the browser-only offline preview. `npm run tauri dev` starts and owns its Vite server, then supplies the actual listening URL to the native window; do not launch Vite separately for this command. The preferred development port is 1420, configured once in `scripts/development.mjs`. If it is occupied, Vite chooses the next available port and Tauri follows that exact URL. No application connection port is fixed to this development preference. No server connection or audio playback starts automatically.

To choose a port explicitly on macOS/Linux:

```sh
PHEMIOS_DEV_PORT=1500 npm run tauri dev
```

PowerShell: `$env:PHEMIOS_DEV_PORT = "1500"; npm run tauri dev`. An explicit port is strict: a collision reports an error instead of changing the chosen value. Invalid ports are refused. Use the npm wrapper for native development; invoking the underlying Tauri CLI directly bypasses Vite orchestration. Stopping or interrupting the development command closes its owned server. The packaged app runs without Vite and needs no development port.

The browser preview uses a fictional catalog and cannot authenticate. The native app starts empty, or reopens the last public catalog/artwork cache. Use **Connexion Aède** with an explicitly started Aède server and account; synchronization and available artwork prefetch then run natively. Aède must include the additive presentation/artwork/media-job/M3U contracts described in `docs/design/native-integration.md`; an older server reports unavailable services rather than substituting demonstration data.

Artist/album pages, banner/background/portrait, independently hideable histogram rails (years by default), the rotating country globe and compact cover rows are available. Native account actions include artist/album ratings, icon favourites, tags and visual Markdown notes (Milkdown), favourite lists, collection rule creation/editing, listening-history reads, server M3U save/download, and explicit FlacCompagnon/spectrum jobs. The relationship graph presents bounded local collaborations with their source. Statistics include server totals, duration/storage, metadata completeness, independently paged audio/credit breakdowns, existing diagnostics, local artwork coverage and current-owner summaries. Playback/output/lyrics/effects and external-drive transfer remain unavailable controls.

## Native connection and storage

Start Aède with its existing catalog and an initialized account (see Aède's account instructions):

```sh
aede serve --port 3412 --data /path/to/aede-data
```

Choose `http://127.0.0.1:3412` in the app. Remote access requires HTTPS; URLs with embedded credentials, paths, queries and redirects are refused. Passwords are discarded after authentication. Bearer tokens stay inside the native process and are never persisted or returned to the webview. An administrator on the local server is required for media jobs; ordinary users can change their own annotations, collections and playlists. Auditors have read-only controls and server enforcement.

Public catalog and artwork live in Tauri's application data directory, under `cache/`. On macOS this is `~/Library/Application Support/fr.craftandcode.phemios/cache/`. Downloaded M3U files are saved in `~/Downloads/Phémios/` on macOS, with the exact server content; repeated downloads preserve existing files. Private annotations remain on Aède and are loaded into memory only for the current account. Offline navigation reuses synchronized images; unavailable or unreadable media are explicit. Cold prefetch and large-library behavior still need native scrolling measurements. Resynchronization reuses artwork for an unchanged catalog version; rescan Aède after replacing an existing image. There is no automatic cache quota/pruning yet.

The read-only native smoke probe accepts a private JSON file with `server`, `username`, `password` on standard input (never use command-line passwords):

```sh
cargo run -p phemios-core --example probe --locked < /private/path/login.json
```

Keep that file outside the repository with mode `0600`. The probe prints only counts, authenticates, pages the real library, validates a cover and its disk-cache round trip, logs out and removes its own temporary cache. It does not run analyses or modify personal values.

## Verify and build

```sh
npm run format
npm run check
npm run build:native
```

`tools/check.sh` is authoritative and runs formatting, correctness lint, behavior tests, frontend type checking/build, Tauri bridge-version validation, Rust formatting/tests/Clippy/Rustdoc and native executable compilation. Native bundling is separate. `npm run build:native` builds the host platform's app bundle. The checked-in configuration enables no arbitrary shell, HTTP or filesystem plugin. Windows distribution will require an explicit offline-WebView2 packaging decision.

## Project map

- `src/`: SolidJS views, pure filtering/presentation policies and centralized native calls.
- `core/`: framework-independent Rust client policies, with no Tauri or catalog dependency.
- `src-tauri/`: native wiring, typed commands, minimum capabilities and app icons.
- `tools/check.sh`: authoritative verification gate.
- `docs/coding/current-state.md`: current implementation and verified limits.
- `docs/design/interface.md`: accepted interaction and capability contracts.
- `docs/design/roadmap.md`: coherent implementation phases.
- `docs/coding/dependencies.md`: dependency purpose, sources and compatibility evidence.

See the current-state document before claiming server, artwork, playback, physical output or device-copy support.

## License

Project sources use MPL-2.0, matching Aède. The starter derives from the tauri-project-start template; its upstream FlacCompagnon MIT notice is retained under `licenses/`. App identity derives from Aède's source assets.
