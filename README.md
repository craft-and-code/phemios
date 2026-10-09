# Phémios

Phémios is the local-first desktop client for Aède, built with SolidJS, TypeScript and Tauri 2. It presents Aède's graph and capabilities without duplicating the engine or changing source music files.

## Start

Use Node.js 22.12+ within major 22, major 24 or 26+, and Rust 1.90+, plus the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/). The resolved Tauri crates declare Rust 1.90; builds here were verified with Rust 1.99. Execution on the minimum toolchain is still pending.

```sh
npm ci
npm run dev
npm run tauri dev
```

`npm run dev` serves the browser-only offline preview. `npm run tauri dev` starts and owns its Vite server, then supplies the actual listening URL to the native window; do not launch Vite separately for this command. The preferred development port is 1420, configured once in `scripts/development.mjs`. If it is occupied, Vite chooses the next available port and Tauri follows that exact URL. No application connection port is fixed to this development preference. Remote authentication and audio playback never start automatically. Once explicitly enabled, the isolated local engine reconnects on subsequent launches.

To choose a port explicitly on macOS/Linux:

```sh
PHEMIOS_DEV_PORT=1500 npm run tauri dev
```

PowerShell: `$env:PHEMIOS_DEV_PORT = "1500"; npm run tauri dev`. An explicit port is strict: a collision reports an error instead of changing the chosen value. Invalid ports are refused. Use the npm wrapper for native development; invoking the underlying Tauri CLI directly bypasses Vite orchestration. Stopping or interrupting the development command closes its owned server. The packaged app runs without Vite and needs no development port.

The browser preview uses a fictional catalog and cannot authenticate. The native app starts empty, or reopens the last public catalog/artwork cache. Use the top-right gear → **Settings / Paramètres → Libraries / Bibliothèques** to enable local Aède and add folders, connect a separately started Aède server, or use both. Synchronization and available artwork prefetch run natively; Local/Server badges retain each edition’s origin when both catalogs exist; a sole library needs no source selector or badge. Tracks combines both catalogs in bounded pages. Aède must include the additive presentation/artwork/media-job/M3U contracts described in `docs/design/native-integration.md`; an older server reports unavailable services rather than substituting demonstration data. Restart the Aède server and Phémios after updating their native/export contracts; already running processes keep their old code.

Artist/album pages with sharp available banners and blurred fallback headers, biography-first artist details and enlarged album covers, banner/background/portrait, independently hideable histogram rails (years by default), the rotating country globe and compact cover rows are available. Native account actions include immediately saved artist/album ratings and icon favourites, plus explicitly saved tag pills with current-account autocomplete and visual Markdown notes (Milkdown), a favourite cover grid including favourite artists’ discographies, collection rule creation/editing and server evaluation, dynamic collection creation from current catalog filters, confirmed owner-only history reset and listening-history reads, server M3U save/download, and explicit FlacCompagnon/spectrum jobs. Track icons expose readable FlacCompagnon results and saved spectra. Results provide original-format JSON downloads per track or album, assembled by Aède from retained source entries. The relationship graph presents bounded local collaborations with their source. Statistics include server totals, duration/storage, metadata completeness, independently paged audio/credit breakdowns, existing diagnostics, local artwork coverage and current-owner summaries. Native album/track and contextual artist-discography playback, transport, consumed-time seeking, mute/volume and output discovery/selection are connected. DSP requests album normalization through Aède; without-effects requests no gain/tone effects while format adaptation and app volume still apply. Bit-perfect is explicitly unavailable on remote f32 PCM/CPAL. Lyrics, visualizers and external-drive transfer remain separate work.

## Local engine and settings

The build/dev wrapper prepares a target-specific Aède executable from the sibling `../aede` repository. Set `PHEMIOS_AEDE_SOURCE` to another checkout or `PHEMIOS_AEDE_BINARY` to a compatible prebuilt executable when needed. The standalone bundle contains that executable and does not require a separate Aède installation.

Enable local Aède in Settings → Libraries, select folders with the native picker, then start a scan explicitly. OS-mounted network folders are supported; unavailable roots retain their catalog entries instead of being treated as empty directories. Local data and a private generated account secret stay under the application data directory, separately from any existing Aède installation. Closing Phémios stops only its owned engine.

The same Settings view hosts accounts, existing roots/exclusions, shared private external-service keys and explicit enrichment operations on both eligible libraries by default. Key changes take effect on the next job; the remote server retains its own defaults and requires the `fetch_service_keys` capability for app-owned keys. Settings → Appearance applies and remembers French/English and three colours with Reset. The language changes live without interrupting playback; catalog titles, notes and tags retain their original text. See [managed local engine](docs/design/local-engine.md) and [localization](docs/design/localization.md).

## Native connection and storage

Start Aède with its existing catalog and an initialized account (see Aède's account instructions):

```sh
aede serve --port 3412 --data /path/to/aede-data
```

Choose `http://127.0.0.1:3412` in the app. Remote access requires HTTPS; URLs with embedded credentials, paths, queries and redirects are refused. Passwords are discarded after authentication. Bearer tokens stay inside the native process and are never persisted or returned to the webview. An administrator on the local server is required for media jobs; ordinary users can change their own annotations, collections and playlists. Auditors have read-only controls and server enforcement.

Public catalog and artwork live in Tauri's application data directory, under `cache/`. On macOS this is `~/Library/Application Support/fr.craftandcode.phemios/cache/`. Downloaded M3U and FlacCompagnon JSON files are saved in `~/Downloads/Phémios/` on macOS, with server content preserved (JSON is pretty-printed); repeated downloads preserve existing files. The remote connection dot is fixed dark grey when only the local engine is in use. A red/green animated connection dot otherwise follows an authenticated session check every 15 seconds; polling runs only after native login and respects reduced motion. Private annotations remain on Aède and are loaded into memory only for the current account. Offline navigation reuses synchronized images; unavailable or unreadable media are explicit. Cold prefetch and large-library behavior still need native scrolling measurements. Resynchronization reuses artwork for an unchanged catalog version; rescan Aède after replacing an existing image. There is no automatic cache quota/pruning yet.

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

## App icon

The approved [editable p-dot icon](assets/brand/phemios-icon.svg) uses the shared off-white/accent palette and a dark rounded tile with transparent corners. PNG, ICNS and ICO resources come from this one master, along with the browser favicon. On macOS, Tauri development explicitly installs the configured ICNS (PNG fallback); a packaged `.app` uses its bundle resource. An old Dock icon can be cached independently of current source. Restart the native process after regenerating icons; building/launching the `.app` is the reference distribution check.

## Internet radio

Open **Radio** under **Sources Musicales**, then explicitly search the Radio Browser community directory by station name, country or style. HTTPS streams are preferred by default; disable the checkbox to include older HTTP addresses, which may be blocked by the platform. The dial slides through the current fifty-station page; select a station and press Play. Internet streams use the system WebView's supported codecs and audio output. Pause releases the stream; resume rejoins the live broadcast. Aède login is not required. Directory and station availability depend on their external providers. No radio playback is added to Aède's catalogue listening history.
