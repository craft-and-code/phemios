# Phémios — Project instructions

## Priorities

- Local-first desktop client for Aède. Ordinary offline navigation performs no network requests.
- Never modify source audio files or their tags.
- Aède owns the music graph, identities, query semantics, accounts, playback and copy rules. Phémios presents these contracts; it does not create a second engine.
- Keep local facts, external attributed claims and derived results distinct. Unknown values are not false values.
- Unsupported capabilities and invalid input are explicit errors or unavailable controls, never silent fallbacks.
- Personal data and unreadable stores must not be destroyed implicitly. Cache data is disposable; credentials and annotations are not cache data.
- Every important behavior has a meaningful test; every bug fix begins with a failing test.

## Architecture

`src/` contains SolidJS views, pure presentation policies and centralized typed IPC. `core/` is framework-independent Rust for native client policies, with no Tauri dependency. `src-tauri/` owns native wiring and capability validation. Aède domain rules remain in Aède. Do not invoke arbitrary shell commands or expose broad filesystem/network capabilities.

Keep UI rendering pure and reactive. Use effects for external synchronization, not derived state. Keep modules focused, usually below 250 physical lines; explain coherent exceptions. Document exported contracts with JSDoc/Rustdoc, explaining constraints rather than restating types.

## Rust and TypeScript

Rust 1.89+ baseline, subject to dependency/MSRV validation. Follow `rustfmt.toml` and `clippy.toml`. Prefer minimum visibility, borrowed values and readable code. Library code must not use `unwrap` or `expect`. No unsafe code without explicit justification. TypeScript is strict, including unchecked-index and optional-property checks. Handle malformed data and storage failures visibly.

## Dependencies and network

The accepted stack is SolidJS, TypeScript, Vite and Tauri 2. Prettier, Oxlint and Vitest support the requested formatting, lint and behavioral verification. Explain and obtain agreement before introducing an additional product dependency. Keep npm and Cargo lockfiles, with matching Tauri Rust/API major and minor versions. Respect external service policy; opening a page must not fetch enrichment automatically.

## Verification

`tools/check.sh` is authoritative: formatting, lint, behavioral tests, TypeScript/build, bridge compatibility, Rust format/tests/Clippy/Rustdoc and native executable build. Run it before commits. `npm run build:native` additionally bundles the app. Distinguish browser checks, native host checks, other platforms and physical audio/copy acceptance.

## Documentation and Git

Repository-facing documentation, comments and commits are English; the initial UI is French. Use fictional libraries and generic paths. Keep durable design in `docs/design/`, present status in `docs/coding/current-state.md`, and stable engineering rules here. Markdown has no maximum line length. Commit one coherent part at a time, with imperative English subjects of at most 72 characters. Create commits only when the user requests them; do not publish or push without authorization.
