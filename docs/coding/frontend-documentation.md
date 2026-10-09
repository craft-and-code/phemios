# Frontend documentation and verification

## Language and public contracts

All frontend implementation in `src/` is strict TypeScript (`.ts` policies/transport and SolidJS `.tsx` views). CSS, SVG and other assets remain in their native formats. Node build/check scripts are `.mjs`; the native client and Tauri adapter are Rust. Type checking includes unchecked indexed access and exact optional properties.

Exported contracts use authored JSDoc with TSDoc-style descriptions of constraints, ownership and failure behavior. This is available in editor hover/completion. Formal TSDoc parsing/linting and a complete comment-coverage audit are not installed; do not describe this as formally validated TSDoc.

## Generate and read

Run `npm run docs:ts`. The installed TypeScript CLI emits public `.d.ts` declarations while preserving authored comments. A small local script assembles escaped declarations into `dist-docs/frontend/index.html`; no documentation product dependency is required. Test declarations and empty modules are omitted. Open that HTML file locally; its adjacent `types/` directory contains the declarations. Generated output is ignored by Git and is rebuilt by the authoritative check.

This reference describes public types and existing comments, not private implementations, a usage tutorial or a test-coverage report. Durable behavioral/architecture explanations remain in `docs/design/`; Rust contracts use `cargo doc --workspace --no-deps --locked`.

## Tests and their limits

`tools/check.sh` runs formatting, lint, Node tooling/style checks, Vitest behavior tests, TypeScript/production frontend build, declaration documentation, Tauri bridge compatibility, Rust formatting/tests/Clippy/Rustdoc and native executable compilation. Native application bundling and UI acceptance are additional checks.

The current suite has 158 TypeScript behavior tests, 12 Node tooling/style tests and 52 framework-independent Rust core tests. It covers filtering, identity parsing, privacy/session boundaries, persistence refusal, paging, annotations, playback policies, analysis presentation, localization, radio lifecycle and selected native transport rules. New regression cases first fail before the fix.

It does not prove exhaustive unit coverage of every rendering component or Tauri adapter. No percentage claim is made. macOS native observations are recorded in [UI acceptance](ui-acceptance.md). Windows/Linux execution, platform radio decoding, minimum-toolchain execution, acoustic/digital fidelity and physical network-mount/copy acceptance remain separate work. Keep tests aimed at meaningful behavior rather than mirroring JSX or claiming unsupported hardware guarantees.
