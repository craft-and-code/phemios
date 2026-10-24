# Dependency baseline

Versions were checked against npm registry metadata and official product documentation on 2026-10-08. Exact resolutions live in the npm/Cargo lockfiles.

- SolidJS 1.9.17: fine-grained interface reactivity.
- Milkdown kit 7.22.2 (MIT, explicitly approved): visual CommonMark notes, editor history and formatting commands through a framework-neutral adapter. Loaded as a separate chunk only on detail pages. Markdown remains the Aède storage format; image/link rendering does not fetch remote resources or navigate.
- TypeScript 7.0.2: strict source checking.
- Vite 8.3.3 and vite-plugin-solid 2.11.14: local development and Solid JSX build; the plugin declares Vite 8 support.
- Tauri Rust/API/CLI 2.12.1: desktop window, build and typed native IPC. Rust/API major and minor are verified from lockfiles.
- Prettier 3.9.9: shared formatting.
- Oxlint 1.87.0: correctness lint without a second compiler/configuration stack.
- Vitest 5.0.3: TypeScript behavior tests; existing Node tests verify bridge-version refusal.
- Serde (existing Tauri layer): serialize the typed native response.
- ureq 3.4.0 (explicitly approved): bounded blocking HTTP/HTTPS in the independent native core, matching Aède's client version; no home-made HTTP/TLS parser or webview network plugin.
- serde_json 1 (explicitly approved): validate JSON contracts and store public snapshots. The core uses JSON values without introducing another direct serialization dependency.

The current development host uses Node 26 and Rust 1.99. Node 22.12 within major 22, major 24 and 26+ satisfy the tooling requirements; odd majors 23 and 25 are excluded by Vitest. The project engine declaration follows that intersection.

`cargo metadata --locked --offline --filter-platform aarch64-apple-darwin` shows that Tauri 2.12.1, its build/runtime/utils crates, muda and tray-icon declare Rust 1.90. The workspace minimum is therefore 1.90, corrected from the template's 1.89. This is metadata compatibility evidence, not a build on the minimum toolchain. The whole gate and release bundle passed with Rust 1.99 on the current Mac. Minimum-toolchain and other-platform execution remain pending.

Sources: [SolidJS](https://docs.solidjs.com/quick-start), [Vite](https://vite.dev/guide/), [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), [Tauri frontend](https://v2.tauri.app/start/frontend/), [Milkdown kit](https://milkdown.dev/docs/guide/using-milkdown-kit), and each named package's npm registry metadata. The official Tauri scaffolder supports SolidJS.

The approved network dependencies are recorded in Cargo.lock. ureq uses its standard certificate validation; redirects are disabled. The note editor adds the approved Milkdown frontend dependency; no broad filesystem, shell, audio or HTTP plugin is added.

## Additional accepted runtime dependencies

The current lockfiles also include the explicitly approved `d3-geo` for bounded local globe projection, CPAL/rtrb for the native consumed-frame output, tungstenite for authenticated Aède PCM, getrandom for the owned engine's secret, quick-xml for bounded RSS parsing and tauri-plugin-dialog for selected native folder/file dialogs. No general shell, filesystem or HTTP plugin is granted to the WebView. These dependencies serve existing features; this hardening lot introduces no product dependency.

The security boundaries are recorded in [client hardening](hardening.md). A clean advisory check is a statement about the checked lockfile and database at that time, not a proof that the application has no vulnerabilities.

## Shared Lucide icon vocabulary

The maintainer-approved `lucide-solid` 1.61.0 (ISC) supplies all 98 semantic UI icon names through 96 statically imported components. Its Solid peer range accepts the existing SolidJS 1.9.17. `src/components/icon-symbols.ts` preserves navigation, saved-menu and device names; `Icon.tsx` applies 18 px, 1.6 stroke width and inherited color consistently. Unknown/older dynamic names retain the neutral List fallback. Imports are explicit so the production build excludes the rest of Lucide; no font, CDN or runtime icon download is involved. Model names remain text rather than claiming a model-specific Lucide silhouette.

The former isolated `public/icons/lucide-piano.svg` copy is retired. The complete upstream license remains at `public/licenses/lucide.txt`; Settings → About credits Lucide and the generated dependency list reports its exact locked version. Graphs, waveforms, geographic data and product wordmarks remain purpose-specific visuals. The component explorer retains its existing Icon examples and adds the complete vocabulary plus interactive transport-state checks. Source and usage: [official Solid integration](https://lucide.dev/guide/solid), [upstream repository](https://github.com/lucide-icons/lucide).

## Local audio CD source

The explicitly approved `cd-da-reader` 1.0.0 (MIT, complete license retained at `public/licenses/cd-da-reader.txt`) is isolated in `crates/phemios-cd`. It uses native macOS/Linux/Windows CD-drive APIs, with libc/cc or windows-sys as platform dependencies. Phémios adds no unsafe block, decoder, resampler, privilege-escalation helper or external CD service. The existing CPAL/rtrb transport remains responsible for output. Cargo.lock retains all dependency versions and About's generated Cargo credits include the new library. See [CD playback](../design/cd-playback.md) for device rights, bounded streaming, account restrictions and physical acceptance limits.

## Display inhibition dependency review

The explicitly approved `keepawake` 0.6.1 supplies the display/idle guard described in [native integration](../design/native-integration.md#display-and-idle-inhibition-during-playback). The following is retained review evidence, not a fresh advisory lookup.

Dependency review queried the 41 newly locked registry versions. The Linux D-Bus graph carries three maintenance notices published on 2026-10-17: [RUSTSEC-2026-0370](https://rustsec.org/advisories/RUSTSEC-2026-0370.html) (`zvariant` 5.15.1), [RUSTSEC-2026-0371](https://rustsec.org/advisories/RUSTSEC-2026-0371.html) (`zbus_names` 4.3.5), and [RUSTSEC-2026-0372](https://rustsec.org/advisories/RUSTSEC-2026-0372.html) (`zvariant_derive` 5.15.1). These packages were folded into zbus 6; the approved keepawake release still uses the zbus 5 Linux backend. No security advisory was returned for these added versions in that query. No audit exemption or policy was changed. This review does not claim a clean full-workspace audit or Linux runtime acceptance.

## Security follow-up

The resolved Linux GTK3 chain retains `glib 0.18.5`, affected by [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html), ; the former `proc-macro-error` branch is removed by Lot 3b below. This dependency is not compiled on macOS; absence of authored `VariantStrIter` calls does not prove upstream Linux reachability is safe. The former Tungstenite/rustls-native-certs branch is corrected below; its rustls-pemfile notice is removed from the current graph. Reassess the compatible native stack before distribution; do not silently broaden exceptions from another repository. Aède's separate desktop policy records its exact explicitly approved GTK combinations. Lockfiles, fresh registry checks and applicable target trees remain authoritative; Git dependencies and external tools need their own review.

## Targeted security resolution — 2026-10-23

rustls-webpki 0.103.16, webpki-roots 1.0.10, Tokio 1.53.3, DOMPurify 3.4.17 and Storybook/addon-docs/builder-vite/react-dom-shim 10.6.3. The Storybook Solid adapter remains 10.7.2 and its declared peer ranges accept the updated stack. React peers, native dependency versions outside the three Lot 1 Cargo patches, shared-audio source pins and product features remain unchanged.

Fresh lockfile audits find zero npm vulnerabilities and zero Cargo vulnerability matches, while retaining GLib unsoundness and the four remaining maintenance warnings (proc-macro-error, zbus_names, zvariant and zvariant_derive). No allowlist/ignore or omitted development dependencies. Tests/builds and unresolved acceptance limits are recorded in the [Lot 1 campaign ledger](../quality/release-checklist.md#8-d-ph-04--lot-1-targeted-security-updates). This does not audit the prebuilt Aède engine or certify the entire application.

## Tungstenite migration — 2026-10-23

Lot 2 upgrades the existing authenticated PCM transport from Tungstenite 0.24.0 to 0.30.0, retaining `rustls-tls-native-roots`. rustls-native-certs 0.8.5 removes rustls-pemfile 2.2.0 entirely from Cargo.lock; RUSTSEC-2025-0134 no longer matches. Native certificate loading remains enabled, and pinned owned-server connections still use their sole certificate root. Native-certs 0.8 can return usable certificates alongside loading errors; Tungstenite logs those errors and rejects an empty native store. No bundled-root substitution or validation bypass is introduced.

Required transitive updates include rand 0.10.3/rand_core 0.10.1/chacha20 0.10.2, SHA-1 0.11.0 with its digest dependencies, openssl-probe 0.2.1 and macOS security-framework 3.7.0. SHA-1 continues to serve the WebSocket protocol handshake, not audio-file integrity. Obsolete Tungstenite-only packages are pruned. All 14 added/updated package versions declare an MSRV of at most 1.85; this metadata check does not replace execution on the project's Rust 1.90 minimum. Other dependency versions, npm locks and shared-audio pins remain unchanged.

Messages now use Utf8Bytes/Bytes with explicit conversions; incoming payloads remain borrowed for JSON/PCM admission. The non-exhaustive configuration uses builders, explicitly retaining a 4 KiB read buffer instead of the new default 128 KiB, immediate writes, a 64 KiB write cap and 32 KiB frame/message caps. Existing TCP deadlines, authentication and source/account ownership stay unchanged. Real loopback boundary/fragmentation/authentication tests and both accepted/refused HTTPS/WSS identities pass. Linux/Windows native-store acceptance remains pending.

Fresh full audits: npm zero vulnerabilities; Cargo zero vulnerability matches, with GLib unsoundness and four maintenance notices still visible. No ignore, deny exception or feature removal. The [Lot 2 ledger](../quality/release-checklist.md#9-d-ph-05--tungstenite-migration) records checks and the separate stable-engine preparation blocker.

Primary migration references: [Tungstenite changelog](https://github.com/snapview/tungstenite-rs/blob/v0.30.0/CHANGELOG.md), [0.30.0 manifest](https://github.com/snapview/tungstenite-rs/blob/v0.30.0/Cargo.toml), [TLS native-root handling](https://github.com/snapview/tungstenite-rs/blob/v0.30.0/src/tls.rs), and [rustls-pemfile maintenance advisory](https://rustsec.org/advisories/RUSTSEC-2025-0134.html).

## GLib 0.18.5 local soundness correction

Lot 3a applies the explicitly approved upstream #1343 correction while retaining version/API 0.18.5. Only the mutable out-pointer declaration and argument change in the published source; no macro migration or new product dependency. The original registry archive/checksum, all imported bytes, MIT license and patch provenance are recorded in [vendor/README.md](../../vendor/README.md). The workspace patch selects that source for all GLib 0.18 consumers. GLib-macros/gtk3-macros/proc-macro-error and all other versions remain unchanged.

The Linux-only regression crate uses a dev dependency, leaving normal Mac/Windows builds/tests free of a new GLib SDK requirement. Eight real-library cases pass on this Mac through the explicitly requested optional host harness in debug/release; the old optimized source fails with SIGSEGV. The permanent Linux cases and native UI/minimum-version acceptance remain unexecuted here. The host GLib source also emits 34 existing lifetime-syntax compiler warnings with Rust 1.99; logs retain them, no broad lint suppression or unrelated vendor cleanup is applied.

Use `npm run check:vendor` for offline provenance/source selection and `npm run audit:dependencies` for full registry plus local-source upstream-identity advisory assessment. The latter needs cargo-audit and internet for its private fresh RustSec snapshot. It prints every remaining warning and keeps RUSTSEC-2024-0429 with the local-backport/Linux-pending disposition; raw cargo-audit alone omits path packages. This supplemental inventory never rewrites the product Cargo.lock or invents a fixed version. New/unmapped local-source advisories require review and fail that control. See [Lot 3a evidence and Linux work](../quality/lot-3a-validation.md).

## Local macro diagnostic ports

Lot 3b retains the published glib-macros 0.18.5 / gtk3-macros 0.18.2 APIs with reviewed upstream-derived Syn diagnostics. Both use existing dependencies; proc-macro-error and proc-macro-error-attr disappear from the whole lock graph, along with unused Syn 1. Original source/test/license/checksum provenance remains explicit, and all three local packages participate in source integrity and supplemental advisory checks. The host macro suites preserve all upstream cases/snapshots; the GTK expansion fixture and native Linux acceptance remain pending. See [Lot 3b validation](../quality/lot-3b-validation.md).

At the Lot 3b baseline advisory coverage was three raw D-Bus maintenance notices plus the explicit GLib upstream-affected/local-fix/Linux-pending record. No warning is hidden. Earlier per-lot counts above describe their own historical resolutions. keepawake and zbus are unchanged in Lot 3b.

## Linux keepawake / zbus migration

Lot 4 selects a checksum-inventoried local keepawake 0.6.1, changing only its Linux source and normalized manifest. zbus 6.1.0 replaces the removed blocking API; the port reuses existing Tokio 1.53.3 with an explicitly owned worker, bounded whole acquisition and cleanup, rollback and visible release diagnostics. Mac/Windows source files remain byte-identical. The active local manifest declares Rust 1.89; project minimum stays 1.90. No new global runtime or work in audio callbacks.

The real graph removes zvariant/zvariant_derive/zbus_names and the old runtime-only helpers. Other retained package blocks remain identical except keepawake source/dependencies and required Tokio signal/tracing edges. Existing Windows and num_enum resolutions are retained. Fresh raw Cargo audit has no matches/notices, while the supplemental source inventory still displays GLib RUSTSEC-2024-0429 with pending Linux validation and now also checks keepawake's upstream identity. No suppression or blanket clearance.

Fourteen actual-backend/private-bus cases pass on this Mac, including the before/after release panic, descriptor lifetime, partial rollback, service loss and authentication/method deadlines. The disposable harness's service-side features and mirrored private Options fixture are test-only; this is not native Linux App/desktop acceptance. See [Lot 4 validation and remaining checks](../quality/lot-4-validation.md). Earlier dependency-review counts above are historical phase evidence.
