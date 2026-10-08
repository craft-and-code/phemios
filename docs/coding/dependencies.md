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
