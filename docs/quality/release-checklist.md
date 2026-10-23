# Phémios Release and Stabilization Checklist

## Candidate and authority

- Campaign `PH-STAB-001`, initial pass on 2026-10-23, branch `main`.
- Software candidate `397912b95f79d54a3eb23e64dfe589df7e3c03e7`, version 0.1.0; initially clean. The initial pass changed eight quality Markdown files; D-PH-02 also adds the remediation plan and diagnostic source under this directory. D-PH-03 additionally implements the authorized Lot 0 source/tests/docs correction; dependency files remain unchanged.
- Current authority: Lot 0 correction, tests and checks; earlier read-only pass ledgers are historical. No dependency change, suppression, commit or release performed.
- Host: macOS/Darwin 27.0.0 arm64; Node 26.10.0, npm 11.19.1, Rust/Cargo 1.99.0 Homebrew, cargo-audit 0.22.2. Rust 1.90 and other platforms are not tested.
- FFmpeg and FFprobe 9.0.2 installed. Rust checks set `PHEMIOS_REQUIRE_FFMPEG=1`, `CARGO_INCREMENTAL=0`, `RUSTDOCFLAGS="-D warnings"`. Rust commands use existing locked/offline dependencies.
- Shared audio remains pinned to Aède revision `d8c0f1a8c134b7366da0983367a9f063527085b7`. Existing sidecar metadata says Aède 0.6.1 / FlacCompagnon 0.9.6 and has no audio revision. No rebuilt/coherent current sidecar is claimed.

## 1. Source and findings

- [x] Starting candidate/clean state and actual inspected paths recorded.
- [x] No Aède findings/history or generic FC examples imported as Phémios defects.
- [x] Initial dependency matches and source hypothesis qualified/deduplicated in [findings.md](findings.md).
- [ ] Complete campaign partition coverage and all remaining hypotheses.
- [ ] Resolve significant findings with evidence or permitted explicit dispositions; no Critical waiver.
- [x] PH-007 behavioral regression fails before correction and passes after it; other corrections are unimplemented.

## 2. Automated controls

These current controls incorporate D-PH-03; the first execution ledger below remains historical. Results are for the base commit plus its recorded uncommitted correction and individual profiles. Exact authoritative applicability is in the [scope](audit-scope.md#validation-controls-and-evidence). The partial native compile does not turn full App/installer acceptance green.

| Control                             | Result  | Evidence / limit                                                                                                                                                     |
| ----------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PH-C01 complete App gate            | NOT RUN | `tools/check.sh` selects/prepares a stable engine and may rewrite source pins/locks. No automatic dependency/source change in this phase.                            |
| PH-C02 formatting/lint              | PASS    | Prettier and oxlint successful; formatting rechecked after quality records finalized.                                                                                |
| PH-C03 Node/Vitest                  | PASS    | 46 Node tests + 1,334 Vitest tests in 241 files, no skips/failures reported.                                                                                         |
| PH-C04 types/frontend/analysis      | PASS    | Strict App/component TypeScript, App build and standalone analysis build successful.                                                                                 |
| PH-C05 Rust workspace/harness       | PASS    | 517 Rust executions: 111 native + 282 core + 80 native-session harness + 30 CD + 14 transfer. FFmpeg required; no ignored cases.                                     |
| PH-C06 Rust format/lint/docs        | PASS    | Full workspace format, Clippy all-targets and Rustdoc with warnings denied. Initial native Clippy failure retained, then corrected and rerun.                        |
| PH-C07 bridge/generated docs/site   | PASS    | Bridge, 450 TS modules, component types/static build, full workspace Rustdoc, bilingual site/local links (26 pages).                                                 |
| PH-C08 fresh advisory assessment    | FAIL    | Cargo: 2 vulnerability matches + 2 unsoundness + 5 unmaintained warnings. npm: 2 affected packages classified Critical upstream. PH-001–006 preserve details/limits. |
| PH-C09 native/MSRV/installer matrix | NOT RUN | Current macOS native tests and linked workspace build PASS. Rust 1.90, Linux/Windows, installers remain unexecuted; this whole matrix is not PASS.                   |
| PH-C10 regression/independent pair  | NOT RUN | PH-007 before/after regression PASS; the required independent review pair has not run.                                                                               |

### Execution ledger

Commands run from the repository root. Local logs/metadata live in ignored `target/quality/PH-STAB-001/`; they are not portable committed evidence. The commands, results and SHA-256 below are retained in this tracked record so another context can rerun them. Logs are sanitized (`<repository>`, `<home>`); the original discovery candidate had no source edits; D-PH-03 source changes and evidence are recorded separately below. JSON command manifests contain UTC start/end timestamps for the explicit runner executions (19:21–19:24 local time); the frontend test output starts 19:17:47 local time. No guessed frontend start timestamp is asserted.

| Evidence ID     | Command                                                                                                          | Exit | Sanitized log / SHA-256                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------- |
| analysis-build  | `npm run analysis:build`                                                                                         | 0    | `target/quality/PH-STAB-001/analysis-build.log` — `faf087e79522622bfb8d7fa88f0cb8f75b7fcbeaf8ab21e468511c73382417bb`  |
| app-build       | `npm run build`                                                                                                  | 0    | `target/quality/PH-STAB-001/app-build.log` — `dc484bad30e095f677bda521f3490a77254eb0d698bebfe5721b83899c78c481`       |
| bridge          | `npm run check:tauri`                                                                                            | 0    | `target/quality/PH-STAB-001/bridge.log` — `00d13a3f42356f9e30aab4cbc3c7c10c2bce89a243061d6f9a77b6d209ca0e9e`          |
| cargo-audit     | `cargo audit --no-fetch --json --file Cargo.lock`                                                                | 1    | `target/quality/PH-STAB-001/cargo-audit.log` — `2ebb93fbeb1d67945d65de16b1e3cfd74a5bb2fbe1cb0e2b7d0b3a227397a16c`     |
| component-types | `npx --no-install tsc --noEmit -p docs/components/tsconfig.json`                                                 | 0    | `target/quality/PH-STAB-001/component-types.log` — `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| components      | `npm run components:check`                                                                                       | 0    | `target/quality/PH-STAB-001/components.log` — `90d79ea278cde2f9aed4e0b92cda523529c8761945313a3dd2c0a234e97d1a8e`      |
| format          | `npm run format:check`                                                                                           | 0    | `target/quality/PH-STAB-001/format.log` — `ab3a86b907877582cb8bb401d3de5510871e6457202bf85e2f90aeb594536681`          |
| frontend-tests  | `npm test`                                                                                                       | 0    | `target/quality/PH-STAB-001/frontend-tests.log` — `518b983a490123941d602722c87bc758969a7ad496804b1f71cbfeca2407a930`  |
| lint            | `npm run lint`                                                                                                   | 0    | `target/quality/PH-STAB-001/lint.log` — `28a613d3a78c65aed4ec1613b488dff8952c693a3021e74b5fa837a0bed9d568`            |
| native-check    | `cargo check -p phemios --all-targets --locked --offline`                                                        | 0    | `target/quality/PH-STAB-001/native-check.log` — `c2cfa2d32389c3f7851a164471ff5bfd2452501ec0b597245825e1f841ecc597`    |
| npm-audit       | `npm audit --json --audit-level=low`                                                                             | 1    | `target/quality/PH-STAB-001/npm-audit.log` — `1a160460722fbc4d25e1a8b6ec5d763f6292b4f39a87d83df27123ed7382d0d2`       |
| rust-clippy     | `cargo clippy -p phemios-core -p phemios-cd -p phemios-transfer --all-targets --locked --offline -- -D warnings` | 0    | `target/quality/PH-STAB-001/rust-clippy.log` — `cd3924f813fc8833d1503dd4fb61250b3e14af192999e1bcf7545cdb2aea3d3b`     |
| rust-docs       | `cargo doc -p phemios-core -p phemios-cd -p phemios-transfer --no-deps --locked --offline`                       | 0    | `target/quality/PH-STAB-001/rust-docs.log` — `3b108257daa8f439844db39430e00b4c11130ebbca3f4e585afd380544cd0a2d`       |
| rust-format     | `cargo fmt --all -- --check`                                                                                     | 0    | `target/quality/PH-STAB-001/rust-format.log` — `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`     |
| rust-tests      | `cargo test -p phemios-core -p phemios-cd -p phemios-transfer --locked --offline`                                | 0    | `target/quality/PH-STAB-001/rust-tests.log` — `c2192cd8ca18ccf9b48fb3903ef09d2eb3933d2f86742653b1ecbda2a2e137c1`      |
| site-build      | `node scripts/build-site.mjs --reuse-technical`                                                                  | 0    | `target/quality/PH-STAB-001/site-build.log` — `fe910e8fff2c9e616898811ba0f0b525864dd6872286b9686cada51adb667c05`      |
| site-check      | `node scripts/check-site.mjs dist-site`                                                                          | 0    | `target/quality/PH-STAB-001/site-check.log` — `eaded947d2e59ec1ad54389913820301652914826b479aa43757fe29f7582721`      |
| ts-docs         | `npm run docs:ts`                                                                                                | 0    | `target/quality/PH-STAB-001/ts-docs.log` — `10c9beb09d11ab65625f4c97104942f7f0427f662a952ab2b991ba6ec125a384`         |
| types           | `npx --no-install tsc --noEmit`                                                                                  | 0    | `target/quality/PH-STAB-001/types.log` — `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`           |

The Rust test command requires the environment above. The first shell-wrapped Rust run returned wrapper status 1 despite all 399 test summaries passing and no test diagnostic failure. Preserve `initial-rust-tests.log`; the exact raw Cargo exit was not captured separately in that attempt. A single explicit subprocess rerun captured Cargo exit 0 and the same 399 passing tests; no code/environment workaround or dependency change was made. Initial npm audit returned a wrapper status 0 with a nonempty critical report; the explicit `--audit-level=low` assessment above returns 1. Advisory gate classification follows the actual report, not the earlier wrapper's success status.

The initial cargo-audit fetched the RustSec database. Its captured snapshot has 1,351 advisories, commit `84d943a6deeb8cc6c6f632531aaf4f1c62275239`, updated 2026-10-23T16:42:16+02:00. The ledger's `--no-fetch` run assesses that same current snapshot; npm queries the registry. Cargo's report does not audit prebuilt sidecar contents, external Git crate code or native system libraries comprehensively. No ignores or audit policies were added.

Site validation checks generated local pages/links. It is not a live website, installed-app or browser usability acceptance test. Build-generated technical outputs can coexist with older native Rustdoc under target; this pass generated only the three library Rustdoc sets and does not assert all native technical docs are fresh.

## 3. Phémios-specific acceptance and limits

- [ ] Exhaustively trace all source/account/session IPC entry points and frontend lifecycle transitions (selected helpers inspected; existing harness passed).
- [ ] Complete private documents/backups crash and cross-platform filesystem acceptance (selected invariants/tests inspected; no corruption demonstrated).
- [ ] Update PH-004 installed sanitizer dependency (production-profile reachability narrowed in D-PH-02) and correct the confirmed PH-007 returning-root transfer admission.
- [ ] Actual UI/logout/HQPlayer/CD/network-output interactions, physical audio, optical/MTP/iPod devices and live providers.
- [ ] Match embedded engine/shared-audio source, exercise native transfer fixtures with the newly prepared engine, and build/install platform artifacts.

## 4. Initial report and independent review

The campaign is launched and its first coordinator discovery is recorded as D-PH-01. Application behavior suites and individual software checks pass; the advisory assessment fails. Seven records remain open: six dependency/maintenance records and the PH-007 transfer defect confirmed in D-PH-02. No record is fixed, waived or deferred. Initial pass reproduced no application exploit/data loss; D-PH-02 subsequently reproduces PH-007 on temporary files. No real-library loss or clean exhaustive audit is claimed.

- [ ] First qualifying independent review on the candidate/scope.
- [ ] Second consecutive qualifying independent review with distinct focus/context.
- [ ] All significant findings and hypotheses receive supported dispositions.
- [ ] All mandatory software controls PASS; no environment exception substitutes for missing controls.
- [ ] Maintainer accepts residual risks and the closure recommendation.

Current campaign verdict: **`FIX AND REVALIDATE`**. This is the initial coordinator recommendation, not an independent closure validation. Next: investigate/prepare bounded corrections for PH-001–007, complete full native evidence, then obtain fresh independent reviews. Maintainer closure decision: **not issued**.

## 5. Source preservation and release authority

Initial read-only discovery before/after SHA-256 comparison: **PASS, 1217 tracked files outside `docs/quality/` unchanged at that phase**. The subsequently authorized D-PH-03 correction intentionally changes source/tests/design/current-state files; its unchanged-dependency checks are recorded below. Local link/anchor validation: **PASS**; git diff whitespace check: **PASS**. Evidence is recorded in local `baseline-fingerprints.json` / `preservation.json`; the initial pass contained eight intended quality files; the authorized D-PH-02 follow-up additionally introduces its plan and reproduction. That read-only limit applied to D-PH-01/02; D-PH-03 supersedes it for Lot 0 only. No source/test/dependency/version/lock/policy change is allowed to be inferred from generated caches, docs or audit reports.

Release authorization: **not granted** by this task. No commit, tag or publication performed. Campaign closure, if later achieved, still requires a separate identified release decision and applicable artifact/acceptance evidence. Upstream Critical classifications and unresolved application impact remain visible.

## 6. D-PH-02 follow-up

- Dependency remediation plan: [remediation-plan.md](remediation-plan.md), based on actual target trees and primary registry/source metadata. Proposed version changes are not executed.
- PH-007 verification: **PASS for diagnostic execution; CONFIRMED High product defect** in the after-preview/explicit-replacement case. Reproduction exit 0 demonstrates the unsafe old behavior, not a passing safety regression. Replacement-disabled control preserves the existing audio. No correction claimed.
- DOMPurify: production Vite module inventory completed with `build.write=false`, zero DOMPurify/@milkdown-components emitted module entries. npm alert remains visible; this does not validate other configurations.
- PH-C08 remains **FAIL**. Original warnings/classifications retained; no new ignore, allowlist or audit-level relaxation. Test counts are not increased by this standalone diagnostic.
- Source preservation and final documentation checks are re-executed for this follow-up; native/full-suite results above remain the initial pass's evidence, not newly rerun claims.
- No independent review, campaign closure, commit or release. Current verdict remains **FIX AND REVALIDATE**.

## 7. D-PH-03 — Lot 0 implementation and verification

Authority: maintainer requested Lot 0 code correction, tests and checks, keeping all dependency alerts visible and requesting a commit message. No commit created. Base candidate remains the recorded commit plus the uncommitted Lot 0 source/tests/design/current-state diff; earlier quality changes are preserved.

PH-007: **FIXED — TO VERIFY** (production fix and automated revalidation complete; independent review pending). The native returning-root overwrite regression fails before the fix, then passes on the corrected job. Root-set/identity/availability changes, unavailable local overlap, foreign remote hints, aliases and pre-start refusal are covered. Existing original/nonreplacement, conversion, stale-owner and real loopback HTTPS export tests remain enabled. No claim of arbitrary OS race confinement or physical-device remount acceptance.

Verification environment: same macOS arm64 / Rust 1.99 / Node 26 / FFmpeg+FFprobe 9.0.2 host. Existing embedded Aède 0.6.1 / FlacCompagnon 0.9.6, supplied through PHEMIOS_TRANSFER_ENGINE; PHEMIOS_REQUIRE_FFMPEG=1 and CARGO_INCREMENTAL=0. RUSTDOCFLAGS=-D warnings for workspace docs. No automatic engine selection/preparation; all Cargo build/test/lint/doc checks use --locked --offline.

Results: **517 Rust executions** (111 native, 282 core, 80 native-session harness, 30 CD, 14 transfer), no ignored tests; **1,334 Vitest + 46 Node** cases pass. Net addition: **11 Rust cases**, with existing behavior/count retained. Workspace format/Clippy all-targets with warnings denied/Rustdoc/native build, frontend format/lint/build, analysis build, bridge, TS contracts, static components and 26-page site/local links pass. Rust 1.90, Linux/Windows, installers and physical-device acceptance remain NOT RUN.

Initial full-native Clippy failed on eight needless generic-argument borrows; the initial log remains alongside the successful rerun. These were removed without lint exemptions. The earlier discovery had checked library Clippy, not this full host profile.

Fresh audit result: **FAIL, unchanged visible findings** — Cargo 2 vulnerabilities + 2 unsoundness + 5 maintenance warnings; npm 2 Critical-classified dependency packages. No manifest/lock/source-pin/policy change, ignore, severity downgrade or dev-dependency omission. Dependency fingerprints are verified against the lot entry snapshot.

Before the authorized Lot 0 commit, the full tools/check.sh entry point was executed with the officially resolved stable v0.6.1 selection. It exited 1 at engine preparation: that published tag lacks the shared audio crates. The earlier individual controls passed using the existing sidecar; no dependency file changed during the attempted full gate. Its substantive checks were executed individually with the existing engine instead. This validates this locked macOS candidate, not a newly selected stable engine or packaged release.

### Lot 0 execution ledger

All commands use repository-root cwd. Sanitized local logs and JSON manifests are under ignored `target/quality/PH-STAB-001/lot-0/`. Earlier failed/zero-selection attempts are retained; a standalone diagnostic bypassing the new guard is explicitly historical, not an after-fix job test. Ledger below records actual command exits and log hashes.

| Check                    | Command                                                                                                                                      | Exit | Sanitized log SHA-256                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| red-selected             | `cargo test -p phemios --locked --offline a_watched_root_returning_during_download_cannot_be_overwritten -- --nocapture` (environment above) | 101  | `96e00aee9c74ad9747888bff2df155ead85210706e8852086cb11b5f8c20a412` |
| verified-workspace-tests | `cargo test --workspace --locked --offline` (environment above)                                                                              | 0    | `f31c127968dcb4c292e75ba91566959b5c4d2c76ed6cfe6d6df9508436c1277f` |
| rust-format              | `cargo fmt --all -- --check`                                                                                                                 | 0    | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| clippy                   | `cargo clippy --workspace --all-targets --locked --offline -- -D warnings`                                                                   | 0    | `08240bbb1347de196e311592f59b2a2e9f1d6cb499785558c0abf7eea913fb91` |
| rustdoc                  | `cargo doc --workspace --no-deps --locked --offline`                                                                                         | 0    | `62b225ee18650aaf0dae301d26d2b638e1300269deb82e9cc8576634f0ffe0cb` |
| native-build             | `cargo build --workspace --locked --offline`                                                                                                 | 0    | `d70ea02c702ad4cdc8e9847ee11f40305f6775509e81774e7c14003a82486d8a` |
| format                   | `npm run format:check`                                                                                                                       | 0    | `ab3a86b907877582cb8bb401d3de5510871e6457202bf85e2f90aeb594536681` |
| lint                     | `npm run lint`                                                                                                                               | 0    | `28a613d3a78c65aed4ec1613b488dff8952c693a3021e74b5fa837a0bed9d568` |
| frontend-tests           | `npm test`                                                                                                                                   | 0    | `7e78aeb3083c2ce72eb34f47a24beda6ea1286f8c810618156109d6f43e40331` |
| app-build                | `npm run build`                                                                                                                              | 0    | `243b08b3db9ea5db207eccd39e1af91040391394a246bc4736522239017419e6` |
| analysis-build           | `npm run analysis:build`                                                                                                                     | 0    | `79f53c1501a4479692e6b181a2f4d29971f42b7c50e4804089a3addf42d1dd52` |
| bridge                   | `npm run check:tauri`                                                                                                                        | 0    | `00d13a3f42356f9e30aab4cbc3c7c10c2bce89a243061d6f9a77b6d209ca0e9e` |
| ts-docs                  | `npm run docs:ts`                                                                                                                            | 0    | `10c9beb09d11ab65625f4c97104942f7f0427f662a952ab2b991ba6ec125a384` |
| components               | `npm run components:check`                                                                                                                   | 0    | `2a28be575cd498b186582f9e7f57c18cb92169e116ae275e0393872807033338` |
| site                     | `node scripts/build-site.mjs --reuse-technical`                                                                                              | 0    | `fe910e8fff2c9e616898811ba0f0b525864dd6872286b9686cada51adb667c05` |
| cargo-audit              | `cargo audit --json --file Cargo.lock`                                                                                                       | 1    | `58665c0df7b945bd0bc3abc52b81d1da5e5347302a3c5690b4d2ab2e2cc574ef` |
| npm-audit                | `npm audit --json --audit-level=low`                                                                                                         | 1    | `1a160460722fbc4d25e1a8b6ec5d763f6292b4f39a87d83df27123ed7382d0d2` |

Campaign recommendation remains **FIX AND REVALIDATE** because dependency controls and independent-review/native-platform acceptance remain open. Lot 0 is implemented and automatically revalidated; it does not clear PH-001–006 or authorize a commit/release. Suggested commit subject for this implementation only: `Protect library roots throughout transfer jobs`.

### Lot 0 pre-commit gate attempt

`bash tools/check.sh` was executed as required before committing. Official stable selection: v0.6.1 / `9f1d9a066a0d90600174130e19637e7f84f3514a`; exit 1, because this stable release lacks the shared audio foundation. Formatting/lint/frontend tests/builds/docs/bridge passed before that stop. The locked macOS Rust/native checks above remain individually verified. This is an engine-release prerequisite, not an ignored test or a clean full-gate claim. Manifests/locks are unchanged. Local evidence: `target/quality/PH-STAB-001/lot-0/commit-gate.log` and `.json`. The maintainer explicitly authorized the Lot 0 commit; no release/push is authorized.
