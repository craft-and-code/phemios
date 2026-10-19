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

## Vendored icon artwork

The Genres glyph uses the Lucide `piano` SVG (Lucide Icons and Contributors, ISC). Its original source is retained at `public/icons/lucide-piano.svg`, its complete license at `public/licenses/lucide.txt`, and Settings → About credits links to the official icon page. Icon embeds only its path data in the existing local SVG renderer, using the shared stroke/size/color. No icon runtime package, font or network loading is added. The remaining icon vocabulary stays local. Source: https://github.com/lucide-icons/lucide/blob/main/icons/piano.svg .

## Local audio CD source

The explicitly approved `cd-da-reader` 1.0.0 (MIT, complete license retained at `public/licenses/cd-da-reader.txt`) is isolated in `crates/phemios-cd`. It uses native macOS/Linux/Windows CD-drive APIs, with libc/cc or windows-sys as platform dependencies. Phémios adds no unsafe block, decoder, resampler, privilege-escalation helper or external CD service. The existing CPAL/rtrb transport remains responsible for output. Cargo.lock retains all dependency versions and About's generated Cargo credits include the new library. See [CD playback](../design/cd-playback.md) for device rights, bounded streaming, account restrictions and physical acceptance limits.

## Security follow-up

The resolved Linux GTK3 chain retains `glib 0.18.5`, affected by [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html), and the `proc-macro-error` maintenance notice. This dependency is not compiled on macOS; absence of authored `VariantStrIter` calls does not prove upstream Linux reachability is safe. Tungstenite also retains a `rustls-pemfile` maintenance follow-up. Reassess the compatible native stack before distribution; do not silently broaden exceptions from another repository. Aède's separate desktop policy records its exact explicitly approved GTK combinations. Lockfiles, fresh registry checks and applicable target trees remain authoritative; Git dependencies and external tools need their own review.
