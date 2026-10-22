# Phémios

Phémios is the local-first desktop client for Aède, built with SolidJS, TypeScript and Tauri 2. It presents Aède's graph and capabilities without duplicating the engine or changing source music files.

## Native downloads

The prepared GitHub release workflow produces explicitly named App installers and SHA-256 checksums for macOS Apple Silicon, Windows x64 and Linux x86_64. Tagged releases remain drafts until all platforms succeed and a maintainer reviews them; manual runs provide Actions artifacts only. See [release preparation](docs/coding/releases.md) for engine pinning, version checks, signing limitations and supported formats. This workflow has not yet been validated by a platform release run.

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

Artist/album pages with sharp available banners and blurred fallback headers, biography-first artist details and enlarged album covers, banner/background/portrait, independently hideable histogram rails (years by default), the rotating country globe and compact cover rows are available. Native account actions include immediately saved artist/album ratings and icon favourites, plus explicitly saved tag pills with current-account autocomplete and visual Markdown notes (Milkdown), a favourite cover grid including favourite artists’ discographies, personal tag browsing across artists/albums/tracks with counts and tag search, collection rule creation/editing and server evaluation, dynamic collection creation from current catalog filters, confirmed owner-only history reset and listening-history reads, server M3U save/download, and explicit FlacCompagnon/spectrum jobs. Track icons expose readable FlacCompagnon results and saved spectra. Results provide original-format JSON downloads per track or album, assembled by Aède from retained source entries. The relationship graph presents bounded local collaborations with their source. Statistics include server totals, duration/storage, metadata completeness, independently paged audio/credit breakdowns, existing diagnostics, local artwork coverage and current-owner summaries. Native album/track and contextual artist-discography playback, transport, consumed-time seeking, mute/volume and output discovery/selection are connected. DSP requests album normalization through Aède; without-effects requests no gain/tone effects while format adaptation and app volume still apply. Bit-perfect is explicitly unavailable on remote f32 PCM/CPAL. Retained timed lyrics, visualizers, shuffle, repetition and optional DSP crossfade are available; external-drive copying remains separate work.

## Audio CDs without a server

Open **Sources musicales → CD audio**, before Concerts, with a connected optical drive and an inserted audio CD. Explicit discovery reads the disc's tracks/durations. Playback uses the existing footer, native output/volume, queue and visualizations without connecting to Aède; source files, catalogue and private listening history are unchanged. Physical titles remain “Track N” until identification is implemented. **Open a CUE image** selects a local CUE without mounting it. CUE/BIN, CUE/FLAC and CUE/WAV stream progressively through the same player, with CUE track titles/performers when supplied; APE additionally requires installed FFmpeg/FFprobe. No account is required and no image use is saved. Only audio tracks are supported; see the design for strict format and path limits. Supervised accounts cannot use this unidentified source to bypass listening rules. See [CD playback](docs/design/cd-playback.md) for supported output rates, host device permissions and hardware acceptance limits.

## Local engine and settings

The build/dev wrapper prepares a target-specific Aède executable from the sibling `../aede` repository. Set `PHEMIOS_AEDE_SOURCE` to another checkout or `PHEMIOS_AEDE_BINARY` to a compatible prebuilt executable when needed. The standalone bundle contains that executable and does not require a separate Aède installation.

Enable local Aède in Settings → Libraries, select folders with the native picker, then start a scan explicitly. OS-mounted network folders are supported; unavailable roots retain their catalog entries instead of being treated as empty directories. Local data and a private generated account secret stay under the application data directory, separately from any existing Aède installation. Closing Phémios stops only its owned engine.

The same Settings view hosts accounts, existing roots/exclusions, shared private external-service keys and explicit enrichment operations on both eligible libraries by default. Key changes take effect on the next job; the remote server retains its own defaults and requires the `fetch_service_keys` capability for app-owned keys. Settings → Language changes French/English; Appearance retains eight colours with Reset and portable theme files. Navigation and Shortcuts retain editable menus and key bindings; Backup exports/imports presentation preferences plus podcasts/listened episodes and saved articles of the selected connected account after review, excluding credentials. The language changes live without interrupting playback; catalog titles, notes and tags retain their original text. See [managed local engine](docs/design/local-engine.md) and [localization](docs/design/localization.md).

Settings → Playback also retains **Keep the screen active during playback**, enabled by default for music, audio CDs, radios and podcasts. Pausing, stopping or closing Phémios releases the temporary native request. This private presentation choice is included in preference backups. See [display and idle inhibition](docs/design/native-integration.md#display-and-idle-inhibition-during-playback) for OS support, failure handling and verification limits.

## Native connection and storage

Start Aède with its existing catalog and an initialized account (see Aède's account instructions):

```sh
aede serve --port 3412 --data /path/to/aede-data
```

Choose `http://127.0.0.1:3412` in the app. Remote access requires HTTPS; URLs with embedded credentials, paths, queries and redirects are refused. Passwords are discarded after authentication. Bearer tokens stay inside the native process and are never persisted or returned to the webview. An administrator session is required for media jobs over HTTPS or local HTTP; ordinary users can change their own annotations, collections and playlists. Auditors have read-only controls and server enforcement.

Public catalog and artwork live in Tauri's application data directory, under `cache/`. On macOS this is `~/Library/Application Support/fr.craftandcode.phemios/cache/`. Direct downloads (M3U, FlacCompagnon JSON, spectra, podcast episodes, biographies/Wikipedia text and personal notes) are saved directly in the operating system Downloads directory, without category or source subfolders. Server content is preserved (JSON is pretty-printed), and repeated downloads preserve existing files with collision suffixes. CSV, theme and preference-backup exports retain their native save dialogs. The remote connection dot is fixed dark grey when only the local engine is in use. A red/green animated connection dot otherwise follows an authenticated session check every 15 seconds; polling runs only after native login and respects reduced motion. Private annotations remain on Aède and are loaded into memory only for the current account. Offline navigation reuses synchronized images; unavailable or unreadable media are explicit. Cold prefetch and large-library behavior still need native scrolling measurements. Resynchronization reuses artwork for an unchanged catalog version; rescan Aède after replacing an existing image. There is no automatic cache quota/pruning yet.

The music catalog stays shared; personal annotations, collections, history, preferences and favourites belong to the connected account. Settings → Parental controls lets a trusted local administrator restrict a non-administrator account by artist, radio/RSS access, weekly schedule and daily/weekly listening budget. Guest listening remains unrestricted; policies are server-owned and excluded from Phémios preference backups. See the [parental-control contract](docs/design/parental-controls.md) for scope, short listening leases and offline/cache admission. Podcast subscriptions/listened evidence and saved Wikipedia articles are account-private native documents retained on this device, separated by Local/Server, authority and stable account ID. Logout/source replacement hides the preceding owner’s state; auditors remain read-only. Legacy device-wide subscription/article stores are preserved without automatic reassignment. See the [account-isolation report](docs/coding/account-isolation.md) for session admission, storage limits and verification scope.

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
npm run docs:ts
```

`tools/check.sh` is authoritative and runs formatting, correctness lint, behavior tests, frontend type checking/build, Tauri bridge-version validation, Rust formatting/tests/Clippy/Rustdoc, website/manual assembly and native executable compilation. Frontend public declarations and authored documentation are generated by `npm run docs:ts` at `dist-docs/frontend/index.html`; see [frontend documentation and verification](docs/coding/frontend-documentation.md). Native bundling is separate. `npm run build:native` builds the host platform's app bundle. The checked-in configuration enables no arbitrary shell, HTTP or filesystem plugin. Windows distribution will require an explicit offline-WebView2 packaging decision.

## Project map

- `src/`: SolidJS views, pure filtering/presentation policies and centralized native calls.
- `core/`: framework-independent Rust client policies, with no Tauri or catalog dependency.
- `src-tauri/`: native wiring, typed commands, minimum capabilities and app icons.
- `tools/check.sh`: authoritative verification gate.
- `docs/coding/current-state.md`: current implementation and verified limits.
- [Client hardening](docs/coding/hardening.md): consolidated ownership, cancellation, security and publication contracts.
- `docs/design/interface.md`: accepted interaction and capability contracts.
- `docs/design/client-followup.md`: retained browsing, download feedback and private portable backups.
- `docs/design/parental-controls.md`: administrator-owned account restrictions and listening leases.
- `docs/design/roadmap.md`: coherent implementation phases.
- `docs/coding/dependencies.md`: dependency purpose, sources and compatibility evidence.

See the current-state document before claiming server, artwork, playback, physical output or device-copy support.

## License

Project sources use MPL-2.0, matching Aède. The starter derives from the tauri-project-start template; its upstream FlacCompagnon MIT notice is retained under `licenses/`. App identity derives from Aède's source assets.

## App icon

The approved [editable p-dot icon](assets/brand/phemios-icon.svg) uses the shared off-white/accent palette and a dark rounded tile with transparent corners. PNG, ICNS and ICO resources come from this one master, along with the browser favicon. On macOS, Tauri development explicitly installs the configured ICNS (PNG fallback); a packaged `.app` uses its bundle resource. An old Dock icon can be cached independently of current source. Restart the native process after regenerating icons; building/launching the `.app` is the reference distribution check.

## Internet radio

Open **Radio** under **Sources Musicales**, then explicitly search the Radio Browser community directory by station name, country or style. Enter submits the text fields. Hearts save stations to the connected Aède account; saved stations can be played without repeating the search and are resolved again at playback. HTTPS streams are preferred by default; disable the checkbox to include older HTTP addresses, which may be blocked by the platform. The dial slides through the current fifty-station page; select a station and press Play. Internet streams use the system WebView's supported codecs and audio output. The retired RMC MP3 address is remapped only to the same broadcaster's HTTPS HLS endpoint. Pause releases the stream; resume rejoins the live broadcast. Aède login is not required. Directory and station availability depend on their external providers. No radio playback is added to Aède's catalogue listening history.

Track browsing offers remembered 25/50/100/200-row windows. Tags use one card grid for directly tagged artists, albums and tracks, with visible unresolved targets. Settings remembers scan/enrichment choices without starting jobs, in addition to immediate language/colour changes and explicitly saved connection/keys.

Browse filters belong to each view; Countries starts without rails. Artist discographies alone include attributed missing studio albums with reversible private hiding on updated Aède and an immediately saved visibility preference. Rated albums and Labels add personal ratings and cached attributed label biographies. See [browsing state](docs/design/browsing-state.md). SVG brand proposals remain review assets under `assets/brand/proposals/`.

Podcasts: connect an account, add a public RSS feed in Music sources → Podcasts, select a subscription and explicitly play an episode. Refresh updates its retained episode list; subscriptions and listened markers remain private to that account on this device. Feed/media transport sends no Aède credentials. Audio uses system WebView codecs/output. See [the RSS contract](docs/design/podcasts.md).

Playback now includes a complete-track seekable waveform, native shuffle and an optional 3D particle workspace opened from the footer icon, with queue and local timed lyrics. Settings separates language and eight colours, supports portable theme import/export and synchronizes supported non-secret preferences per Aède account. Ambiances starts with transparent configurable tag/genre rules; automatic emotion inference is not implemented. Updated Aède is required for the additive waveform, preference, mood and exact-track lyrics contracts; rebuild and restart external servers after upgrading. See [native integration](docs/design/native-integration.md), [managed local engine](docs/design/local-engine.md) and [mood discovery](docs/design/mood-discovery.md).

## Component explorer

Run `npm run components:dev` to open the development-only Storybook at `http://127.0.0.1:6006`. Its real SolidJS components expose editable controls, documented states and interaction scenarios. Fixtures use memory only and never connect Aède, access accounts or invoke native capabilities. Configuration and the extension guide live in [docs/components](docs/components/README.md); `npm run components:check` applies strict types and builds the isolated explorer as part of the complete gate. The desktop bundle does not contain Storybook.

## Website preview

The separate bilingual project website and user manual live in [`site/`](site/README.md) and [`docs/manual/`](docs/manual/manifest.json). Run `npm run site:build`, then preview `dist-site/` with `python3 -m http.server 1439 --bind 127.0.0.1 --directory dist-site`. Eleven task-oriented chapters per language cover the application; backend operations link to Aède and analysis interpretation to FlacCompagnon. The same output includes working Storybook, Rustdoc and frontend documentation entry points. Actual UI screenshots use fictional data. No public installer URL is invented and no deployment is performed by the desktop build.

### Concert discovery

Concerts displays JamBase dates directly for the catalogue’s principal artists after a key is configured in Settings → External sources. Venue/local dates, status, ticket links and retrieval time retain JamBase attribution. Searches are explicit and cache completed artists incrementally. Native preflight checks the shared subscription quota; a durable 1,000-attempt ceiling over 32 rolling days survives restart/key replacement. Dedicate the JamBase account to Phémios because unrelated clients share its quota and may incur provider overages. Keys stay outside browser/account preferences. Live acceptance requires a valid key. See [Concert discovery](docs/design/concerts.md).

## Engine releases and the separate Aède app

The embedded development engine is prepared with `--locked --offline`. It now requires Aède 0.5.0 and FlacCompagnon 0.9.6. Aède 0.5.0 is being prepared in the reviewed sibling repository; it is not claimed as already published. `npm run engines:check` checks official releases explicitly. Once a compatible Aède release is published, `npm run engines:update` builds a locked release cache with the latest published analysis core. Ordinary launch performs no release lookup or package download. Explicit `PHEMIOS_AEDE_BINARY` / `PHEMIOS_AEDE_SOURCE` overrides remain available.

To use the separate Aède Tauri server on the same computer, export its public connection JSON and import it under Settings → Aède server. Enter its displayed account/password separately. The import pins only that exact loopback certificate, including audio WSS; it never disables TLS verification or imports a private key. See [the local-engine design](docs/design/local-engine.md).

External-player copying supports reviewed selected music, conversion and read-back through Aède, native MTP and an optional podkit adapter for supported Apple iPods. See [device transfer prerequisites and limits](docs/design/external-transfers.md).

## Quality assurance templates

The [quality workflow](docs/quality/README.md), [audit scope](docs/quality/audit-scope.md), [findings register](docs/quality/findings.md) and [release checklist](docs/quality/release-checklist.md) are reusable preparation templates, not records of completed audits. Role prompts are provided for the [code auditor](docs/quality/prompts/auditor.md), [test engineer](docs/quality/prompts/test-engineer.md), [adversarial reviewer](docs/quality/prompts/adversarial-reviewer.md) and [release validator](docs/quality/prompts/release-validator.md).
