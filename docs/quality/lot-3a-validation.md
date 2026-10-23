# PH-STAB-001 — Lot 3a GLib validation

## Candidate and scope

D-PH-07 starts from `c36149e23dd9e3d88b781a319c399fa00e985be2` plus the preserved, uncommitted D-PH-06 planning records. The maintainer explicitly authorized Lot 3a implementation, tests, possible verification and a final commit, retaining all other alerts and naming Linux validation still pending. No macro migration, broad upgrade, warning suppression, source-pin replacement, push or release is included.

GLib 0.18.5 is the registry-checksummed upstream source with only the two-line `VariantStrIter::impl_get` fix from upstream #1343. The complete imported source, license, original/current hashes and exact patch are in [vendor provenance](../../vendor/README.md). Cargo uses one reviewed local GLib at the original version; every other resolved package/version/checksum/edge remains unchanged apart from adding the test-only harness. Aède's Git pin, native-source selection, npm lockfile and product dependency declarations are unchanged.

## Before/after evidence

On macOS arm64, Rust 1.99, pkg-config GLib 2.90.0:

- Eight actual GLib public-API cases pass against unmodified 0.18.5 in debug mode. This is not evidence of soundness under optimization.
- With release optimization/LTO and one test thread, the same unmodified source fails at `forward_iteration_borrows_empty_ascii_and_unicode_strings` with **SIGSEGV, signal 11**, Cargo exit 101. This is an isolated disposable test process; no catalogue, audio file or user data is involved.
- After changing only the two upstream pointer lines, the same eight tests pass in release. They cover empty/nonempty arrays, empty/ASCII/Unicode strings, forward/backward/mixed iteration, nth/nth_back/last, exhaustion/oversized indexes and rejection of non-string input.
- The committed Linux regression crate preserves those sibling tests. Optional macOS debug and release runners import the same file and vendored library through a disposable host harness; their separate results do not establish Linux App acceptance. Normal Windows/macOS workspace builds/tests do not gain a GLib SDK dependency.

Original evidence under ignored `target/quality/PH-STAB-001/lot-3a/`: `before-debug.log`, `before-release.{log,json}`, `after-release.log`, and `host-debug.log` / `host-release.log`. Preserve the actual failing run; do not substitute a hypothetical crash description. The broader upstream GLib test suite is retained byte-for-byte in the vendor tree but is not claimed as executed by this public-API harness.

The staged whitespace check also reports three expected data-preservation diagnostics: the unchanged upstream LICENSE and its identical distributed copy have a final blank line, and the unified patch contains a required blank context line with its leading space. These are retained visibly to preserve the imported bytes and valid patch syntax, rather than cleaned up or exempted. Authored code/Markdown whitespace checks pass; a blanket clean staged-whitespace result is not claimed.

A separate credits regression fails before adapting the existing credits reader (local GLib was omitted), then passes after reviewed local packages are included. The MIT license is retained in source and static distribution. No unrelated application behavior changes.

## Advisory control

`npm run check:vendor` verifies every imported byte and actual Cargo source selection without network access; it is integrated before tests/engine preparation in the full gate. New integrity/policy tests refuse altered/missing/extra source files, changed patch bytes, incorrect registry substitution, unreviewed local dependencies and path escapes.

`npm run audit:dependencies` performs both the real product audit and a supplemental upstream-identity audit for vendored packages, using one private fresh RustSec database. This is an explicitly labeled source inventory, not a rewritten product Cargo.lock or a claimed fixed version. Unknown local advisories and vulnerability matches fail; known warnings remain visible. Tests cover that failure behavior and cargo-audit's omission of revision fields in no-fetch reports. One preliminary audit wrapper wrongly compared the missing revision field to the fetched field and failed closed; the corrected wrapper uses the same private snapshot for both scans and preserves the initial failure log.

Required visible records remain:

| Package                | Advisory          | Current disposition                                                                     |
| ---------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| GLib 0.18.5            | RUSTSEC-2024-0429 | Upstream affected version; pointer fix backported; Linux integration/validation pending |
| proc-macro-error 1.0.4 | RUSTSEC-2024-0370 | Unchanged maintenance notice; both macro owners still use it                            |
| zbus_names 4.3.5       | RUSTSEC-2026-0371 | Unchanged; Lot 4 pending                                                                |
| zvariant 5.15.1        | RUSTSEC-2026-0370 | Unchanged; Lot 4 pending                                                                |
| zvariant_derive 5.15.1 | RUSTSEC-2026-0372 | Unchanged; Lot 4 pending                                                                |

Raw cargo-audit no longer reports local GLib because local packages are outside its registry matcher. Four raw warnings plus the explicit GLib source record are **five visible review items**. No ignore, allowlist, fake patched version, Linux feature removal or dev-dependency omission. Git dependencies, the prebuilt engine and system libraries remain outside comprehensive lockfile coverage.

## Verification boundaries and remaining Linux work

Current host checks and exact execution ledger are finalized in the [campaign checklist](release-checklist.md). A successful Mac App build confirms host compatibility, not compilation of Linux GTK. Existing software tests do not provide acoustic or physical-device acceptance.

Still required under Linux:

1. Run the eight permanent regressions on the actual production GLib graph in debug and release/optimization, with the declared Rust 1.90 minimum as well as the supported current toolchain. Retain old-source optimized behavior in a disposable comparison where possible; static UB evidence is not invalidated if a different compiler does not crash.
2. Compile/test the real native App with its GTK3/WebKitGTK system prerequisites; verify locked reverse trees resolve all owners to this exact backport. Run Clippy/Rustdoc and a native package build on that platform.
3. Exercise App startup, WebView/IPC, menus/dialogs, server login/logout and clean shutdown under a supported Linux desktop; Xvfb can cover applicable automated GUI paths but does not replace desktop-specific behavior.
4. Re-run full normal and local-source audits; retain the backport's source/advisory record and unchanged macro/D-Bus warnings. Obtain the separate review required by the campaign before closure.

No Linux host/container runtime is available in this session, so those items remain **NOT RUN**. Windows, minimum-toolchain execution and installed packaging are likewise not claimed by Mac checks. The known full-gate stable-engine prerequisite remains separate: published Aède v0.6.1 lacks shared crates. It is reported with the actual gate exit, not waived as a successful gate.

Status: **source fix implemented; Linux validation and independent review pending**. This is not whole-campaign closure or release approval. The larger proc-macro-error backport remains Lot 3b.
