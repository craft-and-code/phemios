# Phémios — Current state

## Product and architecture

Phémios is a SolidJS/TypeScript/Tauri 2 desktop client with a framework-independent Rust core. Aède owns catalogue identities, query rules, accounts, analyses, copies and authenticated PCM. Local embedded and remote libraries can coexist in one source-qualified catalogue. Public catalogue/artwork caches are shared within an authority/catalogue; private data belongs to the exact source/account. Audio files and their tags are never modified.

The application includes artist presentations, Albums/Cover Flow, tracks, countries, genres, composers, labels, private favourites/ratings/tags/collections/history, a shared transient queue, radio, RSS podcasts, local audio CDs/CUE images, concerts, biographies/Encyclopedia, analyses, diagnostics, statistics and portable-device transfers. See the [user manual](../manual/en/getting-started.md) and [native integration](../design/native-integration.md) for capability and availability details.

## Current delivery boundaries

- The embedded engine uses explicit locked/offline preparation. Published-engine updates are explicit; running processes must be restarted to expose changed native contracts.
- Native PCM has DSP/without-effects modes, bounded preloading, repeat/shuffle, consumed-time seeking and optional DSP crossfade. Mode changes apply to future preparation without reopening audible/prepared visits. Bit-perfect is unavailable on this remote f32/CPAL route. See [audio continuity](../design/audio-continuity.md).
- HQPlayer is a separate optional output. UPnP, OpenHome, Cast and SlimProto share one source/account-owned network-device selector through Aède. AirPlay remains deferred.
- CUE/BIN, CUE/FLAC and CUE/WAV use the local CD player without an Aède login; APE requires FFmpeg/FFprobe. Physical optical/device acceptance remains pending.
- JamBase uses a protected native key and a persisted fail-closed request budget. Live provider access is not established by fixture tests.
- Native transfer supports mounted destinations and the explicit MTP/optional podkit paths documented in the design; support is model/firmware dependent, not a promise that every iPod works.
- The [release workflow](releases.md) is prepared for macOS Apple Silicon, Windows x64 and Linux x86_64. Its platform installer jobs have not yet been validated by a Phémios GitHub release run; unsigned drafts require review.

## Verification status

The 2026-10-19 audio/interface checkpoint passed 1,098 frontend, 25 Node tooling and 278 Rust core/native-session tests, strict App/component TypeScript, lint/format, bridge-version validation, core Clippy and Rustdoc. Subsequent release preparation passed 30 Node cases and selected audio tests (178 frontend, 81 Rust). These overlapping checkpoints are not additive test totals and are not a new full native release gate.

The current documentation cleanup changes no product behavior and reruns no application build. Use [verification procedures](frontend-documentation.md) and `tools/check.sh` for a future full gate; that script builds the embedded engine, frontend and native host. Actual App bundling, physical listening/transfers, minimum-toolchain execution and target-platform acceptance are distinct checks. See [UI acceptance](ui-acceptance.md).

## Documentation map

- [Hardening contracts](hardening.md): account ownership, cancellation, searches, private data and provider boundaries.
- [Account isolation](account-isolation.md): private stores and backup scope.
- [Audio performance](audio-performance.md), [visualizer performance](visualizer-performance.md): qualified measurements and retained resource limits.
- [Dependencies](dependencies.md), [frontend verification](frontend-documentation.md), [releases](releases.md): operational procedures.
- `docs/design/`: durable feature contracts; the manual explains use rather than implementation.

Keep this page as a present-state summary. Record decisions in their domain document, regressions in tests, and chronological changes in Git; do not append a report for every review pass.
