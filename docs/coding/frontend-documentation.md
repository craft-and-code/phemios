# Frontend documentation and verification

## Language and public contracts

All frontend implementation in `src/` is strict TypeScript (`.ts` policies/transport and SolidJS `.tsx` views). CSS, SVG and other assets remain in their native formats. Node build/check scripts are `.mjs`; the native client and Tauri adapter are Rust. Type checking includes unchecked indexed access and exact optional properties.

Exported contracts use authored JSDoc with TSDoc-style descriptions of constraints, ownership and failure behavior. This is available in editor hover/completion. Formal TSDoc parsing/linting and a complete comment-coverage audit are not installed; do not describe this as formally validated TSDoc.

## Generate and read

Run `npm run docs:ts`. The installed TypeScript CLI emits public `.d.ts` declarations while preserving authored comments. A small local script assembles escaped declarations into `dist-docs/frontend/index.html`; no documentation product dependency is required. Test declarations and empty modules are omitted. Open that HTML file locally; its adjacent `types/` directory contains the declarations. Generated output is ignored by Git and is rebuilt by the authoritative check.

This reference describes public types and existing comments, not private implementations, a usage tutorial or a test-coverage report. Durable behavioral/architecture explanations remain in `docs/design/`; Rust contracts use `cargo doc --workspace --no-deps --locked`.

## Tests and their limits

`tools/check.sh` runs formatting, lint, Node tooling/style checks, Vitest behavior tests, TypeScript/production frontend build, declaration documentation, Tauri bridge compatibility, Rust formatting/tests/Clippy/Rustdoc and native executable compilation. Native application bundling and UI acceptance are additional checks.

Use the latest verified checkpoint in [current state](current-state.md) and the live `tools/check.sh` summary for suite counts; this reference intentionally does not freeze those changing totals. The suite covers filtering, identity parsing, privacy/session boundaries, persistence refusal and rollback, paging, annotations, playback policies, analysis presentation, localization, spherical country clipping, multi-disc presentation, radio lifecycle and selected native transport rules. New regression cases first fail before the fix.

It does not prove exhaustive unit coverage of every rendering component or Tauri adapter. No percentage claim is made. macOS native observations are recorded in [UI acceptance](ui-acceptance.md). Windows/Linux execution, platform radio decoding, minimum-toolchain execution, acoustic/digital fidelity and physical network-mount/copy acceptance remain separate work. Keep tests aimed at meaningful behavior rather than mirroring JSX or claiming unsupported hardware guarantees.

## Hardening checkpoints

Account preference hydration and explicit imports share a synchronous rollback writer. Every supported retained device value is validated before hydration; unreadable audio/shortcut data is preserved as well as appearance/navigation/tools. User changes made while an account read is pending stay authoritative locally and are coalesced into the final serialized account patches after successful admission. Request generations and captured session objects exclude replacement owners. A failed storage write does not publish partial preferences; a failed rollback is an explicit error rather than a success claim.

Private annotation pagination is a separately documented controller. Each source captures the complete session object and read generation, validates finite pages and same-source identities, and admits the complete projection only after all pages succeed. Reset/disposal suppresses late data and errors. The detail facade also hides retained Solid resource values after logout or reference/session replacement; the annotation panel clears its private drafts before another owner reads. Confirmed concurrent edits survive the read; another source's annotations remain independent. Album annotation decoration keeps sourced genre tags unchanged; personal tags participate in general search through separate search fields, while the Tags view reads owner annotations directly. Retained note Markdown is literal/inert in the visual editor, and public encyclopedia extracts remain literal text. Shared media-address admission rejects non-public IPv4 aliases/reserved literals before browser audio; DNS rebinding and subsequent WebView redirects remain platform limits, not guarantees from frontend validation.

Type checking rejects unused locals/parameters; there is no installed whole-program dead-export or test-coverage analyser. Behavioral suites remain separate from implementation, use fictional/provider fixtures and exercise real refusal/lifetime contracts rather than asserting CSS/JSX internals. A lint/test pass does not establish physical audio fidelity, actual network-mount availability or exhaustive security coverage. See the specific findings and verification in [hardening](hardening.md).
