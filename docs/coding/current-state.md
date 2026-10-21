# Phémios — Current state

## Product and architecture

Phémios is a SolidJS/TypeScript/Tauri 2 desktop client with a framework-independent Rust core. Aède owns catalogue identities, query rules, accounts, analyses, copies and authenticated PCM. Local embedded and remote libraries can coexist in one source-qualified catalogue. Public catalogue/artwork caches are shared within an authority/catalogue; private data belongs to the exact source/account. Audio files and their tags are never modified.

The application includes artist presentations, Albums/Cover Flow, tracks, countries, genres, composers, labels, private favourites/ratings/tags/collections/history, a shared transient queue, radio, RSS podcasts, local audio CDs/CUE images, concerts, biographies/Encyclopedia, analyses, diagnostics, statistics and portable-device transfers. See the [user manual](../manual/en/getting-started.md) and [native integration](../design/native-integration.md) for capability and availability details.

## Current delivery boundaries

- Administrative MusicBrainz review is available in External sources, with durable accept/reject/undo, optimistic revisions and explicit exact-artist biography jobs. Engines must advertise the new capabilities; native App rebuild/acceptance remains separate.
- Process-owned native sessions can be restored after a frontend reload; older hosts expose explicit disconnection recovery after an active-session conflict. Application exit still discards credentials.
- Every native dev/build automatically selects the latest published stable Aède source before fetching dependencies; the engine compilation itself remains locked/offline. Running processes still require restart after replacement. The next stable Aède release must contain the shared crates absent from published v0.6.1.
- Native PCM has DSP/without-effects modes, bounded preloading, repeat/shuffle, consumed-time seeking and optional DSP crossfade. Mode changes apply to future preparation without reopening audible/prepared visits. Bit-perfect is unavailable on this remote f32/CPAL route. See [audio continuity](../design/audio-continuity.md).
- The shared `aede-audio`/`aede-dsp` source now supplies callback transitions, ring handoff and crossfade mathematics. Build preparation updates the workspace/lock to the selected stable SHA and uses the same source for the embedded engine. Each GitHub run selects once across platforms; no sibling checkout is required.
- HQPlayer is a separate optional output. UPnP, OpenHome, Cast and SlimProto share one source/account-owned network-device selector through Aède. AirPlay remains deferred.
- CUE/BIN, CUE/FLAC and CUE/WAV use the local CD player without an Aède login; APE requires FFmpeg/FFprobe. Physical optical/device acceptance remains pending.
- JamBase uses a protected native key and a persisted fail-closed request budget. Live provider access is not established by fixture tests.
- Native transfer supports mounted destinations and the explicit MTP/optional podkit paths documented in the design; support is model/firmware dependent, not a promise that every iPod works.
- The [release workflow](releases.md) is prepared for macOS Apple Silicon, Windows x64 and Linux x86_64. Its platform installer jobs have not yet been validated by a Phémios GitHub release run; unsigned drafts require review.

## Verification status

The latest frontend verification passed 1,315 cases in 240 test files and 46 Node tooling cases, strict App/component TypeScript, lint/format, bridge-version validation and generated TypeScript contracts. Provider integration cases run the actual Solid context with mocked IPC and browser globals; they cover catalogue authority changes, parental preflight retirement, native/browser source handoff, pending gain inheritance, mute restoration, transport shortcuts and late connection/start/stop replies. Framework-independent Rust verification passed 399 cases with none ignored: 281 core, 80 native-session/snapshot/optical-account/audio-admission/HQPlayer harness, 30 CD and 8 transfer. FFmpeg/FFprobe checks were required for this run. Library all-target Clippy with warnings denied and Rustdoc also passed. Native regressions retain Stop/Clear/logout ownership across deferred preparations and replacement logins, recheck source admission after output retirement, and bind HQPlayer configuration and playlist upload to their captured lifetimes. Deferred transport controls retain the accepted output they targeted. Source logout and HQPlayer endpoint teardown retire only their own preparations, while delayed cleanup cannot stop a successor. Refused starts preserve the retained catalogue namespace, and entering HQPlayer clears retired PCM/CD metadata. HQPlayer playback captures its endpoint generation before scheduling blocking preparation; a delayed start cannot adopt another endpoint. Local command refusals preserve a healthy HQPlayer connection; protocol failures retain cleanup. Explicit shuffle choices are idempotent and validated against actual transmitted protocol values. Frontend cases also retire coalesced seeks before replacement startup, preserve the latest explicit seek after an older refusal, and release naturally completed HQPlayer output before local startup settings. The shared harness compiles those actual admission modules without the Tauri application. These are software checks; no live-provider, acoustic or physical-device acceptance is implied.

Storybook and the bilingual site/manual were last regenerated and checked at the earlier 2026-10-20 checkpoint, including local links across all 26 pages. They were not rebuilt for this final code verification.

The authoritative `tools/check.sh` also builds the embedded engine, frontend and native host; those stages were deliberately omitted at the user's request. Its applicable checks were run individually. The native harness compiles the actual framework-independent modules from `src-tauri/`, but other host adapters changed in this lot received static review only. Use [verification procedures](frontend-documentation.md) for the individual checks. Actual App bundling, native-host compilation/execution, physical listening/transfers, minimum-toolchain execution and target-platform acceptance remain distinct checks. See [UI acceptance](ui-acceptance.md).

## Documentation map

- [Hardening contracts](hardening.md): account ownership, cancellation, searches, private data and provider boundaries.
- [Account isolation](account-isolation.md): private stores and backup scope.
- [Audio performance](audio-performance.md), [visualizer performance](visualizer-performance.md): qualified measurements and retained resource limits.
- [Dependencies](dependencies.md), [frontend verification](frontend-documentation.md), [releases](releases.md): operational procedures.
- `docs/design/`: durable feature contracts; the manual explains use rather than implementation.

Keep this page as a present-state summary. Record decisions in their domain document, regressions in tests, and chronological changes in Git; do not append a report for every review pass.
