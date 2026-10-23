# PH-STAB-001 — Lot 3 proposal: GLib and macro dependencies

## Authority and baseline

Coordinator investigation D-PH-06 on 2026-10-23, against clean `main` at `c36149e23dd9e3d88b781a319c399fa00e985be2`. The maintainer requested possible solutions and a plan **before changing dependencies**, retaining every other alert. This pass changes documentation only. No Cargo/npm manifest, lockfile, application/test code, source pin or advisory policy is modified; no commit, publication or upstream message is authorized. This is not an independent review or release approval.

Fresh `cargo audit --json --file Cargo.lock` exits 0 with zero vulnerability matches and **five warnings**, not a clean security verdict: GLib 0.18.5 unsoundness, proc-macro-error 1.0.4 maintenance, and the three existing zbus-family maintenance notices. Database revision `84d943a6deeb8cc6c6f632531aaf4f1c62275239`, updated 2026-10-23T16:42:16+02:00. Cargo audit 0.22.2; local evidence and dependency SHA-256 baseline under `/private/tmp/phemios-lot3-review/`. Those temporary logs are not committed or durable release evidence.

## Confirmed constraints

- Enabled Linux native graph: Tauri 2.12.1 / tauri-runtime / tauri-runtime-wry / Wry 0.57.0 / Tao / muda / WebKitGTK → GTK 0.18.2 → GLib 0.18.5. Multiple owners require GTK 0.18; WebKitGTK 2.0.2 also requires GLib 0.18 directly. A single new direct GLib dependency cannot replace this graph. The sys crates' native-library links and incompatible Rust type identities also prevent treating two GLib generations as interchangeable.
- proc-macro-error 1.0.4 has **two** owners: glib-macros 0.18.5 and gtk3-macros 0.18.2. Both must change before claiming removal. This is a compile-time maintenance notice, distinct from the GLib runtime soundness defect; it is not a demonstrated macro exploit.
- Published GLib 0.18.5 contains the actual faulty immutable out-pointer in `VariantStrIter::impl_get`. Its `next`, `nth`, `last`, `next_back` and `nth_back` paths share that implementation. No authored Phémios call was found in core/native/transfer/CD source; that does not prove transitive Linux code cannot reach it. No exploit or current App crash was reproduced.
- The current macOS target tree contains no GLib. This establishes target selection, not Linux acceptance or safety of the affected source. No Linux host, Docker or Podman executable is available in this environment. Host GLib via pkg-config is a macOS system library and cannot substitute for Linux GUI validation.
- Rust minimum remains 1.90. Updating native components beyond that minimum requires an explicit separate decision.

## Published alternatives checked

| Option                                            | Fresh source/registry result                                                                                                                                                                                                            | Decision for this lot                                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Patch-update Tauri/Wry                            | Latest stable Tauri 2.12.5 still requires GTK `^0.18`; Wry 0.57.1 still requires GTK 0.18 and WebKitGTK `=2.0.2`. Current Tauri runtime 2.12.2 likewise retains GTK 0.18.                                                               | Does not remove these two warning branches; do not upgrade merely to claim this fix.                                           |
| Upgrade GTK3/GLib as a stack                      | GTK **0.19.0** now exists and uses GLib **0.22**; current GLib stable is 0.22.10. These declare Rust **1.92**, and current Tauri/WebKitGTK constraints reject this stack. No newer compatible GLib 0.18 or GTK 0.18 patch is published. | Genuine future upgrade path, but not a drop-in patch or justification for a GTK4 rewrite. Track adoption by the native owners. |
| Use modern macro crates directly                  | Current glib-macros 0.22.9 / gtk3-macros 0.19.0 no longer use proc-macro-error, but belong to the incompatible new stack and use Syn 3.                                                                                                 | Backport the relevant diagnostic changes, not whole modern crates.                                                             |
| Replace with proc-macro-error2                    | Version 2.0.1 supports Syn 2, but its upstream repository was archived on 2026-06-07; last push 2024-09-06.                                                                                                                             | Not recommended as a maintenance fix. Renaming an abandoned dependency would not meet the objective.                           |
| Keep the current graph awaiting upstream adoption | Requires no local maintenance but retains the proven unsafe GLib implementation.                                                                                                                                                        | Honest fallback if a controlled backport cannot be validated; retain both records and warnings.                                |
| Controlled local backports                        | Retain the exact 0.18 APIs and isolate changes to three crates. Upstream fixes exist.                                                                                                                                                   | Recommended immediate correction, subject to approval and Linux validation.                                                    |

Registry lookups are dated evidence, not an executed dependency resolution or claim that the proposed backports already compile.

## Recommended implementation and subsequent authority

D-PH-07: the maintainer subsequently approved implementing, testing and committing **Lot 3a only**. Its source correction and host evidence are recorded in [Lot 3a validation](lot-3a-validation.md). D-PH-08 subsequently authorizes Lot 3b; its results are recorded in [Lot 3b validation](lot-3b-validation.md). No macro change was included in Lot 3a. The earlier planning statements above describe the prior phase.

### Lot 3a — GLib soundness backport

1. Import only the published GLib 0.18.5 source into a dedicated, clearly documented vendor directory. Verify the registry archive checksum against the current Cargo.lock; retain MIT license, release version, original source identity and an explicit local-patch ledger. Published source, rather than an arbitrary third-party fork, is the baseline.
2. Backport upstream [PR #1343](https://github.com/gtk-rs/gtk-rs-core/pull/1343), merge `05dff0ee696f9bcd8617cd48c4b812d046d440cb`: declare the pointer mutable and pass `&mut p` to the variadic C function. Preserve public API, ownership/lifetimes and all unrelated upstream code. Do not fabricate a 0.20 version number or treat adding a null check as the soundness correction.
3. Add sibling regression tests using the actual GLib API, covering empty/nonempty string arrays, Unicode, forward/backward/mixed iteration, nth/nth_back/last and exhaustion. Establish old-source behavior in an isolated process on Linux with optimized builds before applying the correction. If a compiler does not reproduce a crash, retain that result as non-reproduction; do not fabricate a red test or infer the old code is sound. The identified unsafe aliasing and exact upstream diff remain static evidence.
4. Apply a workspace `[patch.crates-io]` only to that local GLib package, then perform a targeted lock update. Verify every GLib 0.18 owner resolves to the reviewed source, without adding a parallel GLib/sys generation, dropping Linux features, changing the Aède pin or broadly refreshing dependencies. This patch and the local-source maintenance responsibility require the maintainer's approval before implementation.
5. Run affected library regressions in debug and release/optimization on Linux, compile the actual native App, and exercise startup, IPC, menus/dialogs and clean shutdown. Keep proc-macro-error and all D-Bus notices visible at this stage. Record the GLib source fix separately from the scanner's version-based disposition.

### Lot 3b — Remove proc-macro-error at both owners

1. Import published glib-macros 0.18.5 and gtk3-macros 0.18.2 with registry checksum and MIT provenance. gtk3-macros' published VCS metadata marks its upstream checkout dirty; use the exact registry archive as baseline rather than assuming that Git SHA alone reproduces the release contents.
2. Port upstream GLib macro change [`c74a40a16b23a1b9c8e67842d32d02bc187f551d`](https://github.com/gtk-rs/gtk-rs-core/commit/c74a40a16b23a1b9c8e67842d32d02bc187f551d): explicit `syn::Result` and compile-error propagation using existing dependencies. The upstream commit spans 13 files / 512 added+removed lines including its lock/policy files; the relevant macro source port is substantially larger than the two-line GLib correction. Inspect all 0.18 macro call sites, including differences from the upstream commit's base. Do not copy upstream lockfiles, deny exceptions or unrelated modernization.
3. Port GTK macro change [`45782251fa35ecf8bfe759ffceb3db32659a0c97`](https://github.com/gtk-rs/gtk3-rs/commit/45782251fa35ecf8bfe759ffceb3db32659a0c97), which replaces abort helpers with Syn diagnostics. Its relevant changes use Syn 2; retain this project's existing Syn/API generation and avoid the later Syn 3 migration. Preserve useful diagnostics, spans and refusal behavior, not just successful expansions.
4. Add narrowly scoped local patches for both macro crates and update the lock graph. Verify proc-macro-error **and proc-macro-error-attr** disappear entirely; adding a new direct replacement would leave the old owners intact. Keep every unrelated resolution unchanged wherever valid.
5. Run upstream macro behavior and compile-pass/compile-fail suites as well as integration with GLib/GTK. Explicitly preserve failure on malformed attributes and unsupported types; a macro must not emit a diagnostic and silently produce a successful expansion. Add regressions in sibling test files and record preserved upstream tests/fixtures. Any adapted compiler-diagnostic snapshots must retain behavioral assertions and an explained compiler-version difference.

Do not mark 3a dependent on completing the larger macro port: prioritize the runtime soundness defect, with a separate reviewable diff/commit when subsequently requested. No blanket fork of the whole GTK/Tauri stack is proposed. Local patches are a maintenance obligation: assign provenance, revalidation and a removal condition when compatible upstream owners adopt fixed packages.

## Preserve advisory visibility across local sources

This is a required part of a backport, not an optional documentation detail. Installed RustSec 0.33.0 skips non-crates.io packages in `Database::query_vulnerabilities`. Two isolated, unmodified-version scanner fixtures confirm it:

| Scanner fixture (not a Phémios lockfile) | Result with cargo-audit 0.22.2 |
| ---------------------------------------- | ------------------------------ |
| crates.io GLib 0.18.5                    | RUSTSEC-2024-0429 visible      |
| Same name/version as a path package      | No matching warning            |

Neither fixture changes or clears the actual application. Thus the earlier general expectation that a backported 0.18 package would automatically retain its scanner warning is insufficient for a local-source patch.

Implementation must keep the normal full audit **and** add an explicit local-source advisory/provenance inventory to the quality output. It must query fresh RustSec records for each vendored package's real upstream name/version, retain RUSTSEC-2024-0429 visibly with status “upstream affected version; local fix verified/pending verification”, and link the reviewed patch/tests. It must also track the vendored macro packages themselves, not only advisories removed from their transitive graph. This is a labeled supplemental source review, not a rewritten production lockfile, fake registry version or ignored advisory. New/unmapped findings must fail the corresponding review control until assessed.

The three zbus-family notices remain unchanged and visible to the normal audit. Only genuinely removed proc-macro-error dependencies may be marked resolved. Do not claim “three warnings left” as full coverage merely because the main scanner stops checking a vendored GLib. The known stable-engine preparation blocker also remains separate and visible.

## Validation and exit criteria

- Source/license/checksum review of each imported crate and exact local diffs; no new unsafe block beyond the explicitly reviewed upstream soundness change. Audit local sources explicitly because lockfile scanning is incomplete for them.
- Locked all-target reverse trees and metadata: one intended GTK/GLib generation, both macro owners corrected, no original proc-macro-error branch, unchanged Aède/npm dependencies and no unrequested feature/MSRV change.
- Linux debug/optimized GLib iterator regressions; GLib/GTK macro positive/negative suites; actual native App compile/startup/IPC/menu/dialog/shutdown acceptance. Prefer Xvfb for automated GUI tests where applicable, with desktop-specific checks recorded separately. No Linux acceptance claim from macOS tests.
- Current Rust 1.90 minimum plus supported macOS/Windows checks; preserve the existing 520 Rust executions and 1,334 Vitest / 46 Node baseline, with new tests counted separately. No known physical audio acceptance follows from these checks.
- Required `tools/check.sh` attempt before any later requested commit, plus individual locked native checks if its known stable-Aède shared-crates prerequisite still blocks. An engine-preparation failure is not a full-gate PASS.
- Fresh full Cargo/npm audits and the explicit local-source advisory inventory; current remaining warnings and precise source-fix disposition retained in the campaign findings/checklist. No ignore/allowlist, fake package version, omitted development graph or disabled Linux support.

At the D-PH-06 planning baseline implementation had not started; subsequent authorized work is recorded in the Lot 3a/3b validation documents. Linux acceptance, minimum-toolchain execution and local-patch maintenance remain prerequisites for closing this lot; if unavailable, retain a pending-validation result.

## Primary references

- [GLib soundness advisory and fixed range](https://rustsec.org/advisories/RUSTSEC-2024-0429.html); [exact upstream pointer correction](https://github.com/gtk-rs/gtk-rs-core/commit/05dff0ee696f9bcd8617cd48c4b812d046d440cb).
- [proc-macro-error maintenance advisory](https://rustsec.org/advisories/RUSTSEC-2024-0370.html); [archived proc-macro-error2 repository](https://github.com/GnomedDev/proc-macro-error-2).
- [Tauri 2.12.5 native dependency constraints](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.5/crates/tauri/Cargo.toml); [Wry 0.57.1 published dependency metadata](https://crates.io/api/v1/crates/wry/0.57.1/dependencies); [GTK 0.19 release workspace](https://github.com/gtk-rs/gtk3-rs/blob/0.19.0/Cargo.toml).
- [GLib registry versions](https://crates.io/api/v1/crates/glib); [GTK registry versions](https://crates.io/api/v1/crates/gtk); [GTK 0.19 published dependencies](https://crates.io/api/v1/crates/gtk/0.19.0/dependencies).
- [GLib macro removal commit](https://github.com/gtk-rs/gtk-rs-core/commit/c74a40a16b23a1b9c8e67842d32d02bc187f551d); [GTK macro removal commit](https://github.com/gtk-rs/gtk3-rs/commit/45782251fa35ecf8bfe759ffceb3db32659a0c97).
- Installed `rustsec-0.33.0/src/database.rs`, `Database::query_vulnerabilities`, confirmed by the isolated registry/path fixtures; [upstream scanner source](https://github.com/rustsec/rustsec/blob/main/rustsec/src/database.rs).
