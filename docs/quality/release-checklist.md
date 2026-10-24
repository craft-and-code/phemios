# Phémios Release and Stabilization Checklist

Current validation candidate: published Aède **v0.7.3**, exact source `85a557681d1a86a851e4e1cb4f806b41adbfcd87`, selected after its actual publication at 2026-10-24T09:53:46Z. Earlier v0.7.2 discovery/review/before-fix evidence below remains historical and exactly attributed. Source preparation changes only the two shared crate versions/revisions; embedded-engine compilation and applicable gates are recorded separately. The stable selection is frozen per validation cycle; an in-progress local release is never substituted.

## Candidate and authority

- Campaign `PH-STAB-001`, initial pass on 2026-10-23, branch `main`.
- Initial software candidate `397912b95f79d54a3eb23e64dfe589df7e3c03e7`, version 0.1.0; initially clean. The initial pass changed eight quality Markdown files; D-PH-02 also adds the remediation plan and diagnostic source under this directory. D-PH-03 additionally implements the authorized Lot 0 source/tests/docs correction; dependency files remain unchanged.
- Current authority: the 2026-10-24 maintainer request authorizes ordered campaign resumption, latest published stable Aède refresh, fresh-context independent reviews, remaining discovery and applicable gates. Present new confirmed defects before correction and retain maintainer validation before commits. No push, tag, workflow dispatch, publication or alert suppression. Earlier lot authorities/results remain historical.
- Current host: macOS 27.0.1 arm64, Xcode 26.6; Node 26.10.0, npm 11.19.1, default Rust/Cargo 1.99.0 Homebrew, cargo-audit 0.22.2. Genuine isolated Rust 1.90.0 workspace tests PASS 550 on this host; Linux/Windows remain unexecuted.
- FFmpeg and FFprobe 9.0.2 installed. Rust checks set `PHEMIOS_REQUIRE_FFMPEG=1`, `CARGO_INCREMENTAL=0`, `RUSTDOCFLAGS="-D warnings"`. The full gate uses locked workspace resolution; engine compilation and separate Rust 1.90 commands explicitly use locked/offline dependencies. Exact historical command profiles are retained in their ledgers.
- Current source: official preparation selects published Aède v0.7.3 / `85a557681d1a86a851e4e1cb4f806b41adbfcd87`; both shared crates and rebuilt bundled engine use that exact source. Initial v0.7.2 and old bootstrap/v0.6.1 metadata below are historical. The full C2 Mac gate, Rust 1.90 host tests, App/DMG builds and read-only packaged-engine inspection actually PASS; platform/installed-runtime acceptance is separate.

## Resumption authority and initial 0.7.2 plan (historical, 2026-10-24)

The maintainer authorizes the proposed ordered PH-STAB-001 resumption: refresh the candidate from the latest actually published stable Aède, independently review retained corrections in fresh contexts, complete the remaining general discovery, execute applicable gates and obtain qualifying general reviews when the candidate is ready. Present new confirmed defects before correction; retain maintainer validation before commits. No push, tag, workflow dispatch, publication or advisory suppression is authorized. Necessary upstream corrections may be proposed, preserving the separate active Aède checkout and its in-progress release work.

The following entry plan records the initial 0.7.2 cycle. Published 0.7.3 C2 results in the current summary and D-PH-16 supersede its then-pending checks.

Entry candidate is clean `main`, `2709c1319a972c4b1b5722c94adab04137a30e55`, with 1,463 tracked/unignored regular files inventoried. GitHub releases/latest and the existing Phémios selector independently identify published non-draft/non-prerelease `v0.7.2`, exact commit `168bd4a4a432aed42957c4ff230ea91d77c6c09f`. The official `scripts/audio-source.mjs` preparation succeeds and changes only the workspace revision and the two shared package lock entries from 0.7.1 to 0.7.2; unrelated resolutions and all local vendor policies remain unchanged. This clears the historical release-availability prerequisite, not PH-C01 itself. The engine/App still require actual compilation and tests on this candidate.

Freeze this verified published selection for one validation/review cycle using the existing `AEDE_AUDIO_RELEASE` mechanism; do not silently adopt a newer release midway through reviewed checks. At the start of a later candidate cycle, resolve the latest published stable release again. A draft, prerelease, local branch or in-progress 0.7.3 is not eligible. If a necessary upstream fix is found, report it and validate its eventual published release as a new candidate; do not substitute the dirty sibling checkout.

PH-001–PH-008 and all prior ledgers remain historical evidence, not fresh candidate passes. First independently examine PH-007 transfer-root admission and PH-008 JamBase lease lifetimes, then extend the risk-path audit across persistence, exact source/account ownership, IPC, asynchronous frontend publication, audio and transfers. PH-003/PH-006 Linux acceptance, Rust 1.90/native matrix, installers and two general clean reviews remain outstanding until evidence is recorded. The full App gate is now authorized, including its controlled engine preparation, without any exception expansion.

## Current C2 control summary (supersedes historical table below)

| Control | Result  | Current evidence / limits                                                                                                                                                             |
| ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PH-C01  | PASS    | Complete `bash tools/check.sh`, C2 published 0.7.3, exit 0; source/engine coherent                                                                                                    |
| PH-C02  | PASS    | Full gate formatting/lint PASS; final parent documentation format/link/whitespace checks PASS, recorded in D-PH-17                                                                    |
| PH-C03  | PASS    | 60 Node +1,439 Vitest in 253 files, no skipped/failing                                                                                                                                |
| PH-C04  | PASS    | Strict App/component types, frontend/analysis/component builds                                                                                                                        |
| PH-C05  | PASS    | 550 Rust host executions with required FFmpeg and coherent new sidecar, none ignored                                                                                                  |
| PH-C06  | PASS    | Workspace Rustfmt, all-target Clippy and Rustdoc with warnings denied                                                                                                                 |
| PH-C07  | PASS    | Bridge, generated TS/Rust/component docs,26-page site/local links                                                                                                                     |
| PH-C08  | PASS    | Fresh raw npm/Cargo 0; provenance verified, supplemental GLib/Linux advisory still explicit                                                                                           |
| PH-C09  | BLOCKED | Mac Rust 1.90 PASS 550, App/DMG builds and read-only image inspection PASS; Linux/Windows native/installer execution and installed-App acceptance remain absent, not hardware waivers |
| PH-C10  | PASS    | Genuine PH009/010/011 red/green evidence; GEN02 + GEN03 consecutive independent GENERAL reviews on identical C2; R-PH-VAL-01 verifies applicability                                   |

See [current validation](media-admission-validation.md) for exact candidates, commands, log hashes, earlier failed attempts, independent attribution and residual limits. This is not campaign closure or release approval.

## 1. Source and findings

- [x] Starting candidate/clean state and actual inspected paths recorded.
- [x] No Aède findings/history or generic FC examples imported as Phémios defects.
- [x] Initial dependency matches and source hypothesis qualified/deduplicated in [findings.md](findings.md).
- [ ] Complete campaign partition coverage and all remaining hypotheses.
- [ ] Resolve significant findings with evidence or permitted explicit dispositions; no Critical waiver.
- [x] PH-007 behavioral regression fails before correction and passes after it; targeted package corrections and the Tungstenite migration are recorded below.

## 2. Automated controls

The summary table below is historical through D-PH-13/D-PH-12, except where a later ledger explicitly updates it; it is not a fresh PASS on the then-selected 0.7.2 candidate or the later C2 software. These recorded campaign controls incorporate D-PH-13; the first execution ledger below remains historical. Results are for the base commit plus its recorded uncommitted correction and individual profiles. Exact authoritative applicability is in the [scope](audit-scope.md#validation-controls-and-evidence). The partial native compile does not turn full App/installer acceptance green.

| Control                             | Result  | Evidence / limit                                                                                                                                                                        |
| ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PH-C01 complete App gate            | BLOCKED | `tools/check.sh` attempted before each commit; stable Aède v0.6.1 lacks shared crates. Frontend stages PASS; pins/locks unchanged.                                                      |
| PH-C02 formatting/lint              | PASS    | Prettier and oxlint successful; formatting rechecked after quality records finalized.                                                                                                   |
| PH-C03 Node/Vitest                  | PASS    | 60 Node tests + 1,334 Vitest tests in 241 files, no skips/failures reported.                                                                                                            |
| PH-C04 types/frontend/analysis      | PASS    | Strict App/component TypeScript, App build and standalone analysis build successful.                                                                                                    |
| PH-C05 Rust workspace/harness       | PASS    | D-PH-12: all 524 Rust cases pass; four added regressions and bounded default-parallel stress pass. Other-platform and independent validation remain pending.                            |
| PH-C06 Rust format/lint/docs        | PASS    | Full workspace format, Clippy all-targets and Rustdoc with warnings denied. Initial native Clippy failure retained, then corrected and rerun.                                           |
| PH-C07 bridge/generated docs/site   | PASS    | Bridge, 450 TS modules, component types/static build, full workspace Rustdoc, bilingual site/local links (26 pages).                                                                    |
| PH-C08 fresh advisory assessment    | PASS    | D-PH-12: npm 0 vulnerabilities; raw Cargo 0 matches/notices; GLib remains explicit in the supplemental local-source assessment. Open warning disposition remains a closure requirement. |
| PH-C09 native/MSRV/installer matrix | NOT RUN | Current macOS native tests and linked workspace build PASS. Rust 1.90, Linux/Windows, installers remain unexecuted; this whole matrix is not PASS.                                      |
| PH-C10 regression/independent pair  | NOT RUN | PH-007, GLib and keepawake host before/after cases PASS; Linux native/desktop and independent review remain pending.                                                                    |

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

## 4. Initial report and independent review (historical)

The campaign is launched and its first coordinator discovery is recorded as D-PH-01. Application behavior suites and individual software checks pass; the advisory assessment fails. Seven records remain open: six dependency/maintenance records and the PH-007 transfer defect confirmed in D-PH-02. No record is fixed, waived or deferred. Initial pass reproduced no application exploit/data loss; D-PH-02 subsequently reproduces PH-007 on temporary files. No real-library loss or clean exhaustive audit is claimed.

- [ ] First qualifying independent review on the candidate/scope.
- [ ] Second consecutive qualifying independent review with distinct focus/context.
- [ ] All significant findings and hypotheses receive supported dispositions.
- [ ] All mandatory software controls PASS; no environment exception substitutes for missing controls.
- [ ] Maintainer accepts residual risks and the closure recommendation.

Initial campaign verdict: **`FIX AND REVALIDATE`**. This is the historical initial coordinator recommendation, not an independent closure validation. Next: investigate/prepare bounded corrections for PH-001–007, complete full native evidence, then obtain fresh independent reviews. Maintainer closure decision: **not issued**.

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

## 8. D-PH-04 — Lot 1 targeted security updates

Lot 1 was authorized and implemented on base `cc1f9fa91092f93790b7b7f505fe8dbed29902aa` (Lot 0 commit `cc1f9fa`). Resolved versions: rustls-webpki 0.103.16, webpki-roots 1.0.10, Tokio 1.53.3, DOMPurify 3.4.17 and Storybook/addon-docs/builder-vite/react-dom-shim 10.6.3. No new direct runtime dependency, override, suppression, broad upgrade or source-pin change. React/react-dom remain 19.3.0; other package versions and Cargo dependency edges retain their prior valid choices. Only the three approved Cargo versions/checksums and five approved npm package versions change. The dependency graph validates with locked/offline Cargo metadata and a clean npm ci --ignore-scripts; npm ls reports no invalid peers.

Fresh npm audit: exit 0, **0 vulnerabilities**. Fresh cargo-audit: exit 0, **0 vulnerability matches**, but **six warnings remain visible**: GLib 0.18.5 unsoundness RUSTSEC-2024-0429; proc-macro-error 1.0.4, rustls-pemfile 2.2.0, zbus_names 4.3.5, zvariant 5.15.1 and zvariant_derive 5.15.1 maintenance notices. PH-003/006 and later migration lots remain open. No clean whole-product security claim: Git source, prebuilt embedded engine and system libraries are not cleared by these lockfile audits.

Verification on macOS arm64 / Rust 1.99 / Node 26: 517 Rust executions, no ignored cases; 1,334 Vitest and 46 Node tests. Full workspace Clippy all-targets/Rustdoc with warnings denied and native build pass; frontend format/lint/build, analysis build, bridge, TS contracts, component types/static build and 26-page site/local link checks pass. Existing correct/wrong-certificate HTTPS/WSS and live loopback original/MP3 transfer tests pass. No new authored runtime code or tests required for these package patches; the audit before/after is the advisory-resolution regression, not a demonstrated hostile-certificate or browser exploit.

All Cargo checks use --locked --offline after an explicit locked fetch. PHEMIOS_REQUIRE_FFMPEG=1, CARGO_INCREMENTAL=0, RUSTDOCFLAGS=-D warnings; PHEMIOS_TRANSFER_ENGINE points to the existing Aède 0.6.1 / FlacCompagnon 0.9.6 binary. No engine preparation/source replacement. The full tools/check.sh was attempted before the Lot 0 commit and stopped on the published v0.6.1 missing shared crates, with no manifest/lock changes; it is not falsely reported as a successful full gate for Lot 1. Rust 1.90, Linux/Windows, installers, real-device and independent reviews remain unexecuted.

The Lot 0 commit was created only after the required full-gate attempt, whose missing-stable-shared-crates failure is retained above. The maintainer subsequently authorized committing Lot 1 and implementing/committing Lot 2. Unrelated valid Cargo edges and React peer versions were retained to eliminate incidental resolver churn; locked metadata and npm ci validate the resulting minimal graph. Preliminary resolver/check logs are retained locally, not substituted for the final-graph evidence. No authored .rs/.ts runtime or test file changes in Lot 1.

### Lot 1 execution ledger

Repository-root cwd; sanitized logs and timestamped JSON records under ignored `target/quality/PH-STAB-001/lot-1/`. Source pins/runtime/test files are unchanged from cc1f9fa. Commands use the environment above; audit exits distinguish warning presence from vulnerability-match failure. No dev-dependency omission or warning allowlist.

| Check          | Command                                                                                                                    | Exit | Sanitized log SHA-256                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| tests          | `cargo test --workspace --locked --offline`                                                                                | 0    | `5f2c51e35ea3c9b56d223336da4a50dc5bd605d7d341073c4ef28ee18d7e0302` |
| format-rust    | `cargo fmt --all -- --check`                                                                                               | 0    | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| clippy         | `cargo clippy --workspace --all-targets --locked --offline -- -D warnings`                                                 | 0    | `d63223c45819b9550237cf1a02b7c13308db7b7f2a037f085b30bbf01bcf3c33` |
| rustdoc        | `cargo doc --workspace --no-deps --locked --offline`                                                                       | 0    | `8151afefa7f1c6af5c0b9c1c3637f22d521bc7dcfaed02a922a873ca9eabb05c` |
| native-build   | `cargo build --workspace --locked --offline`                                                                               | 0    | `469513ae93121bd87c307b1bc7f7f863025eeaa1d5c714fd8805abbf0afa3067` |
| format         | `npm run format:check`                                                                                                     | 0    | `ab3a86b907877582cb8bb401d3de5510871e6457202bf85e2f90aeb594536681` |
| lint           | `npm run lint`                                                                                                             | 0    | `28a613d3a78c65aed4ec1613b488dff8952c693a3021e74b5fa837a0bed9d568` |
| frontend-tests | `npm test`                                                                                                                 | 0    | `c53be6b57a2a7941f2f484a450c5cc6380895a37f8c51f6332cc0671f52e05ce` |
| app-build      | `npm run build`                                                                                                            | 0    | `d2b2ce9d35a7cc5bcba751c27e09ba32a93f85fa995aab78a13e3ec7d4b12368` |
| analysis-build | `npm run analysis:build`                                                                                                   | 0    | `f24e4a2325cb81549f8675029439af5192b000fcd0f75a23149ad20378f7c807` |
| bridge         | `npm run check:tauri`                                                                                                      | 0    | `00d13a3f42356f9e30aab4cbc3c7c10c2bce89a243061d6f9a77b6d209ca0e9e` |
| ts-docs        | `npm run docs:ts`                                                                                                          | 0    | `10c9beb09d11ab65625f4c97104942f7f0427f662a952ab2b991ba6ec125a384` |
| components     | `npm run components:check`                                                                                                 | 0    | `28ba4bd1cc4b9bc55aa8d45c25d6af7d3d50815633fa42d7b6bb1738446a2a54` |
| site-build     | `node scripts/build-site.mjs --reuse-technical`                                                                            | 0    | `fe910e8fff2c9e616898811ba0f0b525864dd6872286b9686cada51adb667c05` |
| site-check     | `node scripts/check-site.mjs dist-site`                                                                                    | 0    | `eaded947d2e59ec1ad54389913820301652914826b479aa43757fe29f7582721` |
| cargo-audit    | `cargo audit --json --file Cargo.lock`                                                                                     | 0    | `c94297506ed6d6645b0bb7f16dca9fdf98799c0c7327026fd1e9353042ee3179` |
| npm-audit      | `npm audit --json --audit-level=low`                                                                                       | 0    | `38a76f6a733e83cdd8ac8c395294119a829620692b2b038c6210a3178283884f` |
| npm-tree       | `npm ls storybook @storybook/addon-docs @storybook/builder-vite @storybook/react-dom-shim dompurify react react-dom --all` | 0    | `f732456df16384cd5e0c6efa564127507c9e6c497eda27fd5e4c0187e2c34bbf` |

Verdict remains **FIX AND REVALIDATE**: package targets are corrected and checked, but PH-003/006, independent reviews, minimum/platform/physical acceptance and full stable-engine preparation remain open. This is not release approval. Suggested Lot 1 commit message: `Update targeted security dependencies`.

### Lot 1 pre-commit gate attempt

The required `bash tools/check.sh` was run again before the authorized Lot 1 commit on 2026-10-23T18:49:39.453458+00:00. Frontend formatting/lint, 46 Node and 1,334 Vitest cases, App/analysis builds, TS contracts, component types/static build and bridge checks passed. The gate exited 1 at engine preparation: official stable Aède v0.6.1 still lacks the shared audio crates. No manifest/lock changed. The individually verified locked/native checks above remain valid; the full gate is not reported as passing. Sanitized log SHA-256: `a2b0cec1ecec84e11482bba27e2c5848b43c29d118c2ec013900df0713e1b8c3`; local evidence: `target/quality/PH-STAB-001/lot-1/commit-gate.{log,json}`. No suppression or release/push authorization.

## 9. D-PH-05 — Tungstenite migration

Authority: maintainer explicitly requested the Lot 1 commit and the Lot 2 implementation, checks and final commit. Lot 1 is `f4cedb3`; Lot 2 base is `f4cedb327568a9bf477ccc8d891f973d5c335145`, plus the recorded source/test/lock/documentation changes. No push, release or later migration is authorized.

Tungstenite 0.30.0 retains native roots and the owned-server certificate connector. rustls-native-certs 0.8.5 removes rustls-pemfile 2.2.0 from the entire graph (RUSTSEC-2025-0134 no longer matches). Required graph changes include rand/chacha20, SHA-1/digest and native certificate platform dependencies; 14 added/updated package versions declare Rust ≤1.85. All other package versions, npm files, dependency policies and shared-audio source pins remain unchanged. Locked/offline metadata validates the graph; metadata is not Rust 1.90 execution.

All authored production/test WebSocket uses were inspected. Text/Binary constructors adapt explicitly to Utf8Bytes/Bytes; parsing still borrows incoming data. Builder configuration retains a 4 KiB read buffer (rather than the new 128 KiB default), immediate writes, 64 KiB write cap and 32 KiB message/frame caps. TCP timeouts/address limits are unchanged. Three new loopback regressions exercise authenticated handshake, Ping/Pong/Text, the exact 32 KiB boundary and refusal at 32 KiB + 1, both single-frame and fragmented. Existing HTTPS/WSS identity coverage adds explicit native-only/wrong-certificate WSS refusal. Previous assertions/behavior/test names are preserved: a multiset comparison retains all 517 previous executions and adds exactly three; no orphaned sibling test module or inline production test introduced.

Final checks on macOS arm64 / Rust 1.99 / Node 26: **520 Rust executions**, none ignored (111 native + 285 core + 80 native-session harness + 30 CD + 14 transfer); **1,334 Vitest + 46 Node**. Workspace Clippy all-targets and Rustdoc with warnings denied, formatting and linked native build pass. The required full gate independently passes frontend format/lint/tests, App/analysis builds, TypeScript contracts, component types/static build and bridge checks, then exits 1 at engine preparation. Official stable Aède v0.6.1 / `9f1d9a066a0d90600174130e19637e7f84f3514a` still lacks shared crates; no manifest/lock changes. This is not a full-gate PASS. Rust/native checks use the existing Aède 0.6.1 / FlacCompagnon 0.9.6 binary, PHEMIOS_REQUIRE_FFMPEG=1, CARGO_INCREMENTAL=0 and RUSTDOCFLAGS=-D warnings. Minimum Rust 1.90, Linux/Windows, native-store interoperability, installers, physical audio and independent review remain unexecuted.

The first new test callback closure triggered Clippy result_large_err because Tungstenite fixes its response/error types. The fixture now implements the library Callback trait directly; final checks pass with no new allow attribute. Preliminary logs, including that failure, are retained under preliminary-*; they are not substituted for final results.

Fresh full npm audit: exit 0, zero vulnerabilities. Fresh Cargo audit: exit 0, zero vulnerability matches, **five visible warnings**. No audit ignore, deny exception, dependency-feature removal or development-dependency omission. Prebuilt/Git/system dependencies remain outside comprehensive lockfile audit coverage.

| Remaining package | Version | Advisory                         | Planned follow-up |
| ----------------- | ------- | -------------------------------- | ----------------- |
| proc-macro-error  | 1.0.4   | RUSTSEC-2024-0370 (unmaintained) | Lot 3             |
| zbus_names        | 4.3.5   | RUSTSEC-2026-0371 (unmaintained) | Lot 4             |
| zvariant          | 5.15.1  | RUSTSEC-2026-0370 (unmaintained) | Lot 4             |
| zvariant_derive   | 5.15.1  | RUSTSEC-2026-0372 (unmaintained) | Lot 4             |
| glib              | 0.18.5  | RUSTSEC-2024-0429 (unsound)      | Lot 3             |

### Lot 2 execution ledger

Repository-root cwd; ignored local evidence under `target/quality/PH-STAB-001/lot-2/`. Records include UTC timestamps, command, actual exit and sanitized log SHA-256. Cargo test/lint/doc/build use --locked --offline after the targeted update/fetch. `metadata.json`, native-root feature tree and all-target reverse trees retain graph/owner evidence.

| Check        | Command                                                                                                                    | Exit | Sanitized log SHA-256                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| tests        | `cargo test --workspace --locked --offline`                                                                                | 0    | `f5249d1f4f2b9a0496ae622480baa64838fa5b96a835253c79c30d37997acb2a` |
| format-rust  | `cargo fmt --all -- --check`                                                                                               | 0    | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| clippy       | `cargo clippy --workspace --all-targets --locked --offline -- -D warnings`                                                 | 0    | `be6bd34d3e022537a5c4892def7195a939406e5c2cee00015089f70828d2497b` |
| rustdoc      | `cargo doc --workspace --no-deps --locked --offline`                                                                       | 0    | `c448a0982ae51f6add519231066efee5b38015934af98cf1e713278757557964` |
| native-build | `cargo build --workspace --locked --offline`                                                                               | 0    | `860a90edb7b23a3a85de1236e10d88108e0eaef272c0ef46b587db084ad0d41c` |
| cargo-audit  | `cargo audit --json --file Cargo.lock`                                                                                     | 0    | `f28071f3ec935ba25f8c23a2e7893d677ebaca06eee21f5880bac20ebcb8f536` |
| npm-audit    | `npm audit --json --audit-level=low`                                                                                       | 0    | `38a76f6a733e83cdd8ac8c395294119a829620692b2b038c6210a3178283884f` |
| npm-tree     | `npm ls storybook @storybook/addon-docs @storybook/builder-vite @storybook/react-dom-shim dompurify react react-dom --all` | 0    | `f732456df16384cd5e0c6efa564127507c9e6c497eda27fd5e4c0187e2c34bbf` |
| commit-gate  | `bash tools/check.sh`                                                                                                      | 1    | `6f1d56ed86fde21c6191a9f1b9557ddd34f1f96e6877ca28ebddb71b759b802c` |
| site-build   | `node scripts/build-site.mjs --reuse-technical`                                                                            | 0    | `fe910e8fff2c9e616898811ba0f0b525864dd6872286b9686cada51adb667c05` |
| site-check   | `node scripts/check-site.mjs dist-site`                                                                                    | 0    | `eaded947d2e59ec1ad54389913820301652914826b479aa43757fe29f7582721` |

The bilingual site was regenerated from current Markdown and fresh technical outputs; all 26 pages/local links pass. Final Markdown source links/anchors, Prettier and Git whitespace checks are also verified before committing.

The gate exit 1 is the explicit stable-engine prerequisite above; individual software checks do not clear PH-C01/C09/C10. Campaign verdict remains **FIX AND REVALIDATE**. PH-003/006 remain open, PH-007 still needs independent review; no whole-product security, hardware or release approval claim.

## 10. D-PH-06 — Lot 3 planning, no dependency modification

Base `c36149e23dd9e3d88b781a319c399fa00e985be2`, initially clean. Maintainer requested possible solutions and a plan before changing dependencies. The [proposal](lot-3-plan.md) verifies Tauri/Wry/GTK constraints and exact upstream correction commits. GTK 0.19 / GLib 0.22 now exist but need Rust 1.92 and are rejected by current native-owner constraints; proc-macro-error2 is archived. Recommend separate local GLib pointer and Syn-based macro backports only after approval. No Cargo/npm/source/policy modification or commit.

Fresh `cargo audit --json --file Cargo.lock`: exit 0, zero vulnerability matches, the same five warnings (GLib; proc-macro-error; zbus_names; zvariant; zvariant_derive), RustSec database 84d943a6deeb8cc6c6f632531aaf4f1c62275239. Locked/offline target trees retain both macro owners on Linux and no GLib on the current macOS target. Manifest/lock SHA-256 values were compared before/after and are unchanged. Local evidence: `/private/tmp/phemios-lot3-review/`; no new product tests or Linux/MSRV execution claimed.

Two isolated scanner-only fixtures using the same actual GLib 0.18.5 version show its warning present for registry source, absent for local path. Installed RustSec source confirms non-default-registry packages are skipped. This is a coverage gap to address in the proposed local-source advisory inventory, not a product fix or reason to hide an alert. No actual lockfile was rewritten for the diagnostic; every current warning stays visible. Source-plan formatting, links and whitespace are checked separately. Campaign recommendation remains FIX AND REVALIDATE; the stable-engine preparation blocker and missing Linux/minimum/native acceptance are unchanged.

## 11. D-PH-07 — GLib 0.18 soundness backport

Base `c36149e23dd9e3d88b781a319c399fa00e985be2` plus preserved D-PH-06 planning documentation. The maintainer explicitly authorizes implementing/testing/checking/committing Lot 3a only. Published GLib 0.18.5 archive checksum was verified before import; all 121 upstream files remain, and only two pointer lines in src/variant_iter.rs change. The lock diff removes the registry source/checksum from GLib and adds one Linux-dev-only regression package; all other package blocks are byte-identical. Product dependency declarations, npm lockfile and Aède pin are unchanged. GLib macro and D-Bus migrations remain outside this lot.

The unmodified library passes eight debug cases, then genuinely crashes with SIGSEGV in release/LTO at the forward-string iteration regression (Cargo exit 101). The exact upstream two-line correction makes all eight pass in release. The final optional macOS host runner imports the same tests and vendored source: eight pass in debug and eight in release. Permanent regressions are Linux-only and do not add an SDK dependency to Mac/Windows workspace checks. No Linux execution is claimed. Upstream inline tests/source formatting remain unchanged, with the existing 34 host compiler lifetime-syntax warnings retained; no broad lint suppression. See [Lot 3a validation](lot-3a-validation.md) for exact pending Linux/minimum/UI work.

Source checks verify every imported byte, patch digest and effective locked Cargo source. Advisory scans use a private fresh RustSec snapshot for normal registry and explicit vendored upstream identities. Four raw maintenance notices plus GLib RUSTSEC-2024-0429 with “upstream fix backported; Linux validation pending” remain visible: no ignore/allowlist, fake fixed version or feature removal. New source advisory/disposition/integrity mismatches fail their controls. The credits regression first fails because local GLib disappears, then passes after the existing reader retains reviewed local packages; the original MIT license is also distributed.

Current macOS checks: **520 workspace Rust executions preserved**, **eight additional GLib cases through the separate host harness in each debug/release profile**, **1,334 Vitest + 55 Node**. Workspace format/Clippy all-targets/Rustdoc with warnings denied and native linked build pass. Full-gate frontend format/lint, offline provenance, tests, App/analysis builds, TS contracts, component types/static output and bridge pass. The required `bash tools/check.sh` then exits 1 at engine preparation because official stable Aède v0.6.1 / 9f1d9a066a0d90600174130e19637e7f84f3514a lacks shared crates; manifests/locks stay unchanged during that attempt. No full-gate PASS, rebuilt coherent engine, installer, Windows/Linux, minimum-toolchain or independent closure claim.

### Lot 3a execution ledger

Repo-root cwd, existing sidecar, PHEMIOS_REQUIRE_FFMPEG=1, CARGO_INCREMENTAL=0, RUSTDOCFLAGS=-D warnings for workspace checks; locked/offline Cargo. Timestamped actual command exits and sanitized log digests live under ignored target/quality/PH-STAB-001/lot-3a/. Preliminary results are retained, including the first fail-closed audit wrapper's fetched/no-fetch metadata mismatch before the private-snapshot correction. No partial result substitutes for a final check.

| Check        | Command                                                                                                                    | Exit | Sanitized log SHA-256                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| tests        | `cargo test --workspace --locked --offline`                                                                                | 0    | `1eeb4afdebe76fc4032f518ecb35ce7889281793599948e4c0dbfe8b4021b63f` |
| format-rust  | `cargo fmt --all -- --check`                                                                                               | 0    | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| clippy       | `cargo clippy --workspace --all-targets --locked --offline -- -D warnings`                                                 | 0    | `0acaedcb15d1aba42d2027d3b7079216bea7d24263b531794089f8dad198b468` |
| rustdoc      | `cargo doc --workspace --no-deps --locked --offline`                                                                       | 0    | `42a1172e93440a45d2d3a172ec8ea7f57b1ffed6707c284eb4949183b3c69905` |
| native-build | `cargo build --workspace --locked --offline`                                                                               | 0    | `24ea42552922af3b8630c4d2524e3aa631f73df1ec92f565799e41d5727a1ac1` |
| host-debug   | `node scripts/glib-regression.mjs`                                                                                         | 0    | `15c1a65a7d070a480646d979f356c41c1ba11ccb4bef18ad92f617c026560fc3` |
| host-release | `node scripts/glib-regression.mjs --release`                                                                               | 0    | `c7acf6b0045be99c48a201109d045e24380f1915520b1ce15aefa90b9dd2429d` |
| cargo-audit  | `cargo audit --json --file Cargo.lock`                                                                                     | 0    | `ffa190b1dd35ceee729d6c3a7234254e3592f0c8dc6f77eb6a2edaae1d1d4135` |
| vendor-audit | `npm run audit:dependencies`                                                                                               | 0    | `1017553840d36c258c8b9461d4452c8d513e1d99082a72aea83df967eb0590c2` |
| npm-audit    | `npm audit --json --audit-level=low`                                                                                       | 0    | `38a76f6a733e83cdd8ac8c395294119a829620692b2b038c6210a3178283884f` |
| npm-tree     | `npm ls storybook @storybook/addon-docs @storybook/builder-vite @storybook/react-dom-shim dompurify react react-dom --all` | 0    | `f732456df16384cd5e0c6efa564127507c9e6c497eda27fd5e4c0187e2c34bbf` |
| commit-gate  | `bash tools/check.sh`                                                                                                      | 1    | `c72d6fec2cb37d5166edd901cc1199800a99199e319420c5b4063f49e2d54473` |
| site-build   | `node scripts/build-site.mjs --reuse-technical`                                                                            | 0    | `fe910e8fff2c9e616898811ba0f0b525864dd6872286b9686cada51adb667c05` |
| site-check   | `node scripts/check-site.mjs dist-site`                                                                                    | 0    | `eaded947d2e59ec1ad54389913820301652914826b479aa43757fe29f7582721` |

All 26 bilingual site pages/local links pass with fresh technical outputs. Final authored Markdown links/anchors, offline source checks, Prettier and Git whitespace are checked before the commit.

Original optimized failure log SHA-256: `25ae3f5ba05ff2ca49e5bddd0c35e872edc328e38e5702d2b559c3069379da65` (SIGSEGV, Cargo exit 101); corrected original release run SHA-256: `9485692e2a5e1bfcce0a8a0d7331092d0425b478b6e02e09a5dca643881bcd81`. Source-only hash comparison against the verified archive changes exactly src/variant_iter.rs.

Verdict remains **FIX AND REVALIDATE**: PH-003 source-corrected pending Linux/independent validation; PH-006 maintenance remains open and PH-007 still needs independent review. Lot 3b is unimplemented. This authorized commit is not release approval.

### Lot 3a final staged-source review

The initial pre-staging `git diff --check` covered tracked authored changes and passed. After adding the original third-party files, `git diff --cached --check` reported three expected preservation diagnostics: original GLib LICENSE and its identical distributed copy retain an upstream final blank line; the valid unified patch retains a space-prefixed blank context line. These were visible and retained without a Git whitespace exemption. They do not change the source-only two-line correction, but the earlier authored check must not be read as an entirely clean import whitespace result. No runtime/test/dependency change follows this evidence clarification. The mandatory full gate is attempted again before amending this same task commit.

Pre-amend gate: `bash tools/check.sh`, 2026-10-23T19:34:50.039008+00:00, exit 1 at the same official stable-engine shared-crates prerequisite after frontend/provenance checks pass. Dependency fingerprints unchanged; sanitized log SHA-256 `9bf0960d91c88646035dd099cc421a8c50ca806e8f44a9564267f38a6f90fc0e`, evidence `target/quality/PH-STAB-001/lot-3a/amend/commit-gate.{log,json}`. Authored documentation is formatted and rechecked before the amended commit.

## 12. D-PH-08 — Macro diagnostic backports

Base 4f18270 plus this authorized Lot 3b source/test/provenance/doc diff. See [validation and pending acceptance](lot-3b-validation.md). Exact original releases, versions and all upstream tests are retained. The targeted graph change removes proc-macro-error/proc-macro-error-attr and unused Syn 1, changes only the two macro source identities, and preserves every other package block, Aède pin, npm lock and platform feature. keepawake/zbus are not modified.

The Mac host passes 25 macro Rust cases (21 unchanged upstream, four new GLib/GTK cases), all 29 upstream clone diagnostic fixtures and four positive clone fixtures, plus 13 new compiler refusals requiring source diagnostics without macro panic. The original unknown-flags input instead panics on the original registry macros. The eight GLib iterator cases are retained through the fully patched host graph. No tests are removed, ignored or silently rewritten. Original third-party compiler/whitespace warnings remain visible. Current coverage keeps three raw D-Bus maintenance notices and GLib's explicit upstream-affected/local-fix/Linux-pending record. No suppression or replacement dependency.

Final commands, exits and sanitized evidence digests follow below. Ignored local logs are under target/quality/PH-STAB-001/lot-3b/. Linux GTK/GLib/native acceptance, Windows, Rust 1.90 and independent review remain pending; this is not release approval.

### Lot 3b execution ledger

Repository-root commands; Rust 1.99/macOS arm64, existing Aède sidecar and required FFmpeg/FFprobe. Workspace Cargo checks use locked/offline resolution; Rustdoc denies warnings. The full gate selects official stable Aède v0.6.1 / 9f1d9a066a0d90600174130e19637e7f84f3514a and fails at its missing shared crates after all frontend/provenance steps pass. Dependency fingerprints are unchanged by that attempt.

| Check        | Actual command                                                                                                             | Exit | Sanitized log SHA-256                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| tests        | `cargo test --workspace --locked --offline`                                                                                | 0    | `d671209ff09530b886370894f080a027144799b41adf80bfbbd70714015ec347` |
| format-rust  | `cargo fmt --all -- --check`                                                                                               | 0    | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| clippy       | `cargo clippy --workspace --all-targets --locked --offline -- -D warnings`                                                 | 0    | `2c3babbb79d1d4815685b518ca579897f2e84e26d7ef2b0e1341d4d2ca5a50b9` |
| rustdoc      | `cargo doc --workspace --no-deps --locked --offline`                                                                       | 0    | `b2d73a9c220ea7e34a4c30ee596e5af45eb4a3a5364b371621d6b570f2d5b2b8` |
| native-build | `cargo build --workspace --locked --offline`                                                                               | 0    | `26e13e2188885ee4683bc72779217179cf69f0c8d289efea8f66e99245f26d44` |
| cargo-audit  | `cargo audit --json --file Cargo.lock`                                                                                     | 0    | `1d920998943d95bc6ce92db0390a5dd85dda56a152b2e5b0b85a4133b504d88f` |
| vendor-audit | `npm run audit:dependencies`                                                                                               | 0    | `9da49de58e9eaa8054dac83842d6451140b394fd59b2c14a592e6c043e15f07a` |
| npm-audit    | `npm audit --json --audit-level=low`                                                                                       | 0    | `38a76f6a733e83cdd8ac8c395294119a829620692b2b038c6210a3178283884f` |
| npm-tree     | `npm ls storybook @storybook/addon-docs @storybook/builder-vite @storybook/react-dom-shim dompurify react react-dom --all` | 0    | `f732456df16384cd5e0c6efa564127507c9e6c497eda27fd5e4c0187e2c34bbf` |
| site-build   | `node scripts/build-site.mjs --reuse-technical`                                                                            | 0    | `fe910e8fff2c9e616898811ba0f0b525864dd6872286b9686cada51adb667c05` |
| site-check   | `node scripts/check-site.mjs dist-site`                                                                                    | 0    | `eaded947d2e59ec1ad54389913820301652914826b479aa43757fe29f7582721` |
| commit-gate  | `bash tools/check.sh`                                                                                                      | 1    | `f8fc86ddf03a9d554d43ba630f03ca55aaea90d3e93bd2929523e8828529abb1` |

Separate host evidence (complete PASS output; unchanged upstream warning messages retained):

| Profile      | Result                                                                          | Log SHA-256                                                        |
| ------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| glib-debug   | 8 actual GLib cases, debug                                                      | `6fdeb0f7a4deb71122a3fa138018b7b8b33f7923f2cc0c6d0069f7ca2c23559e` |
| glib-release | 8 actual GLib cases, optimized release                                          | `4d12d841bf3324927391665d8926d02ef85fb1cc7d11a4cabebec8648af212c9` |
| macro-final  | 25 Rust cases plus 13 compiler refusals; all upstream cases/snapshots preserved | `e6cc0d7651dd86432653b8b58f8fb9ae19c2d7ff75d5e745ef2154df92b2cb87` |

The separately executed locked workspace checks preserve 520 Rust cases. The full gate passes its frontend steps, including 1,334 Vitest / 57 Node cases. All 26 bilingual site pages/local links pass. Macro tests do not substitute for Linux GTK/native acceptance. Verdict remains **FIX AND REVALIDATE**; no new ignore, feature removal, release approval or push.

The final staged whitespace inspection reports preserved upstream LICENSE final blank lines (including identical distributed copies), an unchanged upstream documentation blank line with spaces, and unified-patch context lines with their required leading space. Original source bytes are verified against the archive; no Git whitespace exemption or unrelated cleanup is added. Authored source/documentation passes the whitespace check; the whole imported patch is not described as whitespace-clean.

## 13. D-PH-09 — Lot 4 planning only

Clean base 8eedcbe, the separately authorized Lot 3b commit. The [Lot 4 proposal](lot-4-plan.md) checks published keepawake 0.6.1 and zbus 6.1.0 metadata, upstream Linux/runtime migration sources and the locked all-target reverse tree. No compatible published keepawake update is established. The proposed scoped Linux port requires new private-bus lifetime/failure tests and real Linux/native/minimum-toolchain acceptance. No migration implementation, Cargo/npm/source-pin/feature/advisory-policy change or new test result is claimed by this planning phase. Dependency fingerprints remain unchanged; every current warning remains visible.

## 14. D-PH-10 — Linux keepawake migration

Base 8eedcbe plus the preserved D-PH-09 plan. The maintainer explicitly authorizes source/dependency migration, tests/checks, visible advisories, pending Linux acceptance and final commit. The [validation](lot-4-validation.md) records the exact 21-file source import, two changed files, patch replay, retained Windows/num_enum resolutions, required existing-Tokio edges and fourteen actual Linux-module cases on private Unix buses. All other original source/test behavior is preserved. No ignore/allowlist, Linux inhibition removal, published fork, push or release.

The first workspace test run fails an unchanged JamBase configuration projection case with a busy budget; isolated retry passes. That failure and the initial graph/checks remain in target/quality/PH-STAB-001/lot-4/initial/. No JamBase source/test is changed or ignored and no root cause/permanent fix is claimed. The final full suite result is reported below. Fresh raw audit has no vulnerability/maintenance matches; the supplemental inventory retains GLib RUSTSEC-2024-0429 with its local-fix/Linux-pending disposition, and also scans local keepawake. Linux package/App/desktop/logind, Rust 1.90, Windows and independent acceptance remain pending. Verdict stays **FIX AND REVALIDATE**.

### Lot 4 execution ledger

Actual final commands, exits and sanitized digests follow. Repository-root cwd; Rust 1.99/macOS arm64, required FFmpeg/FFprobe and existing sidecar. Logs remain ignored local evidence under target/quality/PH-STAB-001/lot-4/.

| Check        | Actual command                                                                                                             | Exit | Sanitized log SHA-256                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| tests        | `cargo test --workspace --locked --offline`                                                                                | 0    | `40d15f50df20db30ab95f44572e612b4a42b3beb7a7b63815b6571fd956cea89` |
| format-rust  | `cargo fmt --all -- --check`                                                                                               | 0    | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| clippy       | `cargo clippy --workspace --all-targets --locked --offline -- -D warnings`                                                 | 0    | `339e049216e65f6621a2767ebd3201ebc4d972d01ab0e7a61d9c6280ac7d15ee` |
| rustdoc      | `cargo doc --workspace --no-deps --locked --offline`                                                                       | 0    | `d20d0e7b81d7b23353219777ec644180eeabedcf2cf48f2f8e780cb1b6c32beb` |
| native-build | `cargo build --workspace --locked --offline`                                                                               | 0    | `894555e2cec978fdea6c07e88aa8e91fb06898d948283720176f2bbaa7cfbde0` |
| cargo-audit  | `cargo audit --json --file Cargo.lock`                                                                                     | 0    | `f812a1091986d650023ba8c5d6e6721af0f9e541a915f75c750df7f2f9cbcbeb` |
| vendor-audit | `npm run audit:dependencies`                                                                                               | 0    | `978d1c640c6471273878138d08735768d9cb4b1bf5905468ca45509123bc9c1e` |
| npm-audit    | `npm audit --json --audit-level=low`                                                                                       | 0    | `38a76f6a733e83cdd8ac8c395294119a829620692b2b038c6210a3178283884f` |
| npm-tree     | `npm ls storybook @storybook/addon-docs @storybook/builder-vite @storybook/react-dom-shim dompurify react react-dom --all` | 0    | `f732456df16384cd5e0c6efa564127507c9e6c497eda27fd5e4c0187e2c34bbf` |
| site-build   | `node scripts/build-site.mjs --reuse-technical`                                                                            | 0    | `fe910e8fff2c9e616898811ba0f0b525864dd6872286b9686cada51adb667c05` |
| site-check   | `node scripts/check-site.mjs dist-site`                                                                                    | 0    | `eaded947d2e59ec1ad54389913820301652914826b479aa43757fe29f7582721` |
| commit-gate  | `bash tools/check.sh`                                                                                                      | 1    | `9e51ea3655860786cd2581811182e292fc86a6b618adf202b5f4c9167600dd39` |

The final full workspace run preserves all **520 Rust cases**, with no ignored tests. The gate passes all frontend/provenance stages, including **1,334 Vitest cases in 241 files and 60 Node cases**, App/analysis/type/component/bridge/docs checks. It then exits 1 at the official stable Aède v0.6.1 / 9f1d9a066a0d90600174130e19637e7f84f3514a missing-shared-crates prerequisite, without changing dependencies. Separate locked Rust format/Clippy/Rustdoc/linked build and all 26 site pages/local links pass. This is not a full-gate PASS or Linux/installer acceptance.

| Separate evidence | Result                                                                                                                  | Sanitized log SHA-256                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| before            | Old actual Linux module: UnInhibit refusal panics; regression fails, Cargo exit 101                                     | `f6aab3bfc68a07ebe3ac0156cf0ef265af3e4c196887b9403ed2a8c3399b2d6f` |
| host-final        | Client-only feature compilation plus all-target Clippy with warnings denied and 14 private-bus actual-module cases PASS | `3612d5d596badab9fd8aaf966db28fde31fd363259380b28938574186a5e4ccb` |
| concert-retry     | Unchanged isolated JamBase case PASS after retained initial failure                                                     | `5aaed2b0194239be46223c7e869bc642948f074aa10f42a9a17bb1a867cc76cb` |
| provenance-before | New local-migration provenance test fails before source-check adaptation                                                | `b6864603ddabdfcfdcd96706e2873c708aabc7c6b205886024d6b5a935d08f73` |

Exact patch replay against a newly extracted verified archive reproduces all 21 current source hashes. Added registry packages declare Rust 1.89 (zbus/macros/utils) or 1.88 (zruntime) and MIT licenses; the local keepawake manifest declares 1.89. Actual minimum-toolchain execution is still pending. The final graph changes only the keepawake and required Tokio edges among common retained package blocks; all unrelated Windows/num_enum resolutions remain valid and unchanged. No Cargo/npm exception or unrelated application fix.

The explicit `cargo run -p phemios --example display_awake_probe --locked --offline` exits 0: macOS process assertions are acquired and released with the actual local source package. Sanitized log SHA-256 `3579bff4a1e50fd56c6b08fcc4b9cc9cc3997a8043e108f4d06813509ebe632a`. This is assertion-level host acceptance, not screen-saver timer/Linux/Windows acceptance. Git attributes retain the published LF/CRLF source/license bytes across checkouts without a whitespace exemption.

Final staged-blob verification covers every file in all four vendor inventories and matches the recorded SHA-256 exactly. Full staged whitespace diagnostics are retained: they are confined to original published CRLF files, the identical keepawake license copy, and exact unified-patch/context bytes. Authored files, including the rewritten Linux module, pass their whitespace inspection. No source normalization, Git whitespace exemption or advisory suppression is applied.

## 15. D-PH-11 — JamBase diagnosis and correction proposal

Clean main base 14f382a; the maintainer requests investigation and a plan before source changes, retaining other alerts. [Proposal and primary contracts](jambase-lock-plan.md). Original budget/local source bytes are identical across Lots 3b/4 and throughout this phase; no production/test source, manifest/lock/pin/feature/policy modification or commit. Temporary standalone helpers and syscall interposition are local diagnostics only, never installed globally or presented as an implemented fix.

PH-008 is **CONFIRMED**. Unchanged local tests reproduce three failing runs in fourteen parallel runs; a serial control passes 100 runs and a pure two-JamBase-test control passes 200. Excluding only the explicit cat spawner still fails because mount inspection also creates processes. A projection+cat-only pair fails once in 200 runs. Final tracing reproduces flock LOCK_EX|LOCK_NB / EWOULDBLOCK with close-on-exec already set; the same message is not attributed to corrupt data or a live JamBase outage. Controlled actual public APIs confirm inherited-handle ownership after parent Budget drop, original key/usage preservation and recovery after child exit. Explicit std File unlock succeeds in a separate mechanism control. No correction has been applied.

All samples are bounded diagnostic runs, not production rates. The initial trace helper failed to build against an unavailable SDK convenience header; those failed-load attempts are not counted as test acceptance. The final standalone interposition contract and captured errno-preserving trace replace that setup attempt as evidence. No test is removed or permanently serialized/skipped. No HTTP/provider quota, live credential or original music file is used.

Fresh `npm run audit:dependencies` exits 0, with raw registry 0 vulnerabilities/notices and GLib RUSTSEC-2024-0429 explicitly retained in the supplemental inventory. This changes no advisory disposition or campaign acceptance. Existing Linux/minimum/Windows/installer, stable-Aède shared-crates prerequisite and independent review limits remain. No full gate/release approval is claimed in this read-only planning phase. Verdict remains **FIX AND REVALIDATE**.

D-PH-11 evidence digests (2026-10-23), relative to `target/quality/PH-STAB-001/jambase-review/`:

| Evidence                    | Interpretation                                                          | SHA-256                                                            |
| --------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `baseline.json`             | Source/dependency/inventory fingerprints; all nine rechecked unchanged  | `60fcd0f2bdf087678d0f990630aafec659092b256af23d6325cc24c51d0c5138` |
| `local-stress.json`         | Original local test selection, 12 threads; three failing runs out of 14 | `61f686318f7b5cb4e03891ef1707a734aec3ad34b8ae85fe88d711e4886469fe` |
| `isolation.json`            | Process-spawn pair, exclusion and serial diagnostic comparisons         | `de9ef22ea288dcd337a79f8834ddd8ebef906503c09fd5a9d220b1ca89332260` |
| `additional-isolation.json` | Pure JamBase control and explicitly invalid initial trace setup         | `c4f1d78354f5589bd7eb4b717ec2e95663558855f84b241fc6c8c7b72a43a74f` |
| `traced-failure.log`        | Final unchanged-test flock trace; exit 101                              | `ce698e046dffaf31531608c7fd8b90570d89fbb116b5e171e111eb5196cd6f6f` |
| `fork-reproduction.log`     | Actual public API ownership reproduction and explicit-unlock control    | `384f7d25a964a65cd203d28efe8416179e4209a29ec1ff4da38d90919874a41a` |
| `vendor-audit.log`          | Fresh npm run audit:dependencies; exit 0; supplemental GLib retained    | `978d1c640c6471273878138d08735768d9cb4b1bf5905468ca45509123bc9c1e` |

## 16. D-PH-12 — JamBase lease correction

Base main 14f382a plus D-PH-11 documentation; the maintainer authorizes the reviewed implementation, tests, checks and final commit. [Validation](jambase-lock-validation.md) records a private std-only successful-owner guard, explicit unlock on normal/early-error/unwind paths, preserved genuine-owner exclusion and charged journal state. No API/schema/dependency/pin/advisory-policy change. Scope is the budget implementation, existing sibling tests and supporting docs; all other source/tests are retained byte-for-byte. No push, release or independent-review claim.

Before: two new safe handle-duplication regressions fail on the unchanged code; all eleven old budget cases pass. After: four new cases and all unchanged cases pass, 25 selected concert cases and the unfiltered 524-case workspace. The unchanged 15-case local selection passes 200 default-parallel runs; 15 budget cases pass 100 default-parallel runs, without sleeps/retries/global serialization/permanent filters. Closing a retired plain File duplicate does not release a successor's lock. Five refused journal bodies plus non-file admission confirm cleanup before Budget construction. No real key/provider quota/audio originals are used.

Actual commands from the repository root, macOS arm64/Rust 1.99.0/Node 26.10.0. Rust profiles use CARGO_INCREMENTAL=0; workspace tests require FFmpeg/FFprobe and the existing PHEMIOS_TRANSFER_ENGINE sidecar. Rustdoc denies warnings. Logs below are sanitized local evidence under target/quality/PH-STAB-001/jambase-fix/.

| Check        | Actual command                                                                           | Exit | Sanitized log SHA-256                                              |
| ------------ | ---------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| before       | `cargo test -p phemios-core --locked --offline concerts::budget::tests:: -- --nocapture` | 101  | `7eedd314ac8edb1bf3e439f577d836ac6b8b37cc185e3843616aa3dd13f2bb5b` |
| targeted     | `cargo test -p phemios-core --locked --offline concerts:: -- --nocapture`                | 0    | `923fbc57c8385122205075289cb1afc0c695aa45459334d36c3ccc8910f7b276` |
| commit-gate  | `bash tools/check.sh`                                                                    | 1    | `1b0567a78a0b42949ec9981423aab6270543dae90fa4feb75918cb8e117f203e` |
| tests        | `cargo test --workspace --locked --offline`                                              | 0    | `d53648cb2c8e3e14c6cdb872d2ad44c67c35b5f43c871cde7d1a810493f08a79` |
| format-rust  | `cargo fmt --all -- --check`                                                             | 0    | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| clippy       | `cargo clippy --workspace --all-targets --locked --offline -- -D warnings`               | 0    | `b7883ce17bc4d1c98fca22355f637ea644a2e63f0d0cfb8d03f2c4c0fe53f75c` |
| rustdoc      | `cargo doc --workspace --no-deps --locked --offline`                                     | 0    | `34b8c63502763e0eea592a7edb675739b7d494f73a0cd028879d003f3661d76e` |
| native-build | `cargo build --workspace --locked --offline`                                             | 0    | `396c04a2ef52402ea288f25037b92a021478d1f00a09dddde2849709c0e4d395` |
| vendor-audit | `npm run audit:dependencies`                                                             | 0    | `978d1c640c6471273878138d08735768d9cb4b1bf5905468ca45509123bc9c1e` |
| npm-audit    | `npm audit --json --audit-level=low`                                                     | 0    | `38a76f6a733e83cdd8ac8c395294119a829620692b2b038c6210a3178283884f` |
| site-build   | `node scripts/build-site.mjs --reuse-technical`                                          | 0    | `fe910e8fff2c9e616898811ba0f0b525864dd6872286b9686cada51adb667c05` |
| site-check   | `node scripts/check-site.mjs dist-site`                                                  | 0    | `eaded947d2e59ec1ad54389913820301652914826b479aa43757fe29f7582721` |

Stress command: the built phemios_core unit binary with filter `local::tests::` repeated 200 times, then `concerts::budget::tests::` repeated 100 times, without a test-threads override. JSON SHA-256 `f7d259d8989cf17bf104d2a5d470172156ee92893bef4cc9177c188c1449f203`. Source/dependency fingerprints JSON SHA-256 `c1ea3c26100365a330d5628809396b21f62ab3920d8038d4b6cee070b1ac008a`.

All frontend stages pass (1,334 Vitest/241 files, 60 Node). Full gate exits 1 at the unchanged published stable Aède v0.6.1 missing-shared-crates prerequisite before Rust stages; separate locked Rust checks/native build pass. This does not make PH-C01/C09/independent review green. Actual Linux/Windows, Rust 1.90, installer/provider/physical acceptance remain unexecuted. Fresh raw registry audit has no vulnerabilities/notices; supplemental GLib RUSTSEC-2024-0429 remains explicit, with its local backport/Linux-pending disposition. Existing bundler/deprecation warnings remain visible in the gate log. No suppression or dependency changes. PH-008 becomes **FIXED — TO VERIFY**; verdict remains **FIX AND REVALIDATE**, not campaign or release closure.

## 17. D-PH-13 — Published stable engine gate diagnosis

[Recovery proposal](engine-gate-plan.md), no implementation/dependency/policy/commit/tag/publication. Phémios base 64e5858 and Aède base 19aec35a are clean before documentation. Live releases/latest and read-only engines:check select v0.6.1 / 9f1d9a066a0d90600174130e19637e7f84f3514a; the source lacks aede-audio. Remote annotated v0.7.0 resolves to current Aède main and contains both crates, but run 39992380120 fails both Windows jobs (five Rust failures, one desktop warnings-denied lint), so publish is skipped and no 0.7.0 release/draft is available. Four Mac/Linux jobs succeed. This does not authorize publishing partial artifacts.

All fifteen existing source-selection/embedded-engine Node cases pass, with none skipped. No engine preparation or dependency updater is executed. Failed CI log sanitized SHA-256 `1ccb1b724f7fdf8e1e4c3fe1e14ab95ff626afba68df323ce5d1d5dd0a682ab3`; both-repository source/manifest/lock fingerprint JSON SHA-256 `f2f8908f8c420d0acb11d5b8c024cbe314d5974f2e396668f784b7642e3bb918`. Local evidence: target/quality/PH-STAB-001/engine-gate-review/. Fingerprints are verified unchanged after planning. Existing GLib and Aède separate-workspace alerts remain explicit; this phase is not a new full advisory scan. PH-C01 remains BLOCKED and verdict **FIX AND REVALIDATE**; no independent or release approval.

## 18. Subsequent Phémios maintenance commits (2026-10-24)

The maintainer authorizes committing all pending local Phémios work, without rebuilding the App or pushing. Current checks pass: `npm test` (1,392 Vitest cases/250 files and 60 Node cases), repository Prettier/Oxlint, App/component TypeScript with `--noEmit`, Tauri-version validation, vendor provenance/locked resolution, offline Cargo metadata, and `cargo test -p phemios-core --lib --locked --offline` (291 passed, none ignored). The checked-in shared crates resolve to the same Aède v0.7.1 SHA; read-only latest-stable lookup now returns v0.7.2. See the [later status](engine-gate-plan.md#later-status-2026-10-24) for exact revisions.

`tools/check.sh` is not rerun because it builds the App/engine and generated assets; no new full-gate, installer, platform, advisory or independent-review PASS is inferred. Prior execution ledgers and remaining alerts are retained.

## 19. D-PH-14 — Published stable source and campaign resumption

The current maintainer authorizes ordered resumption, fresh-context independent reviews, remaining discovery and applicable full verification, with new findings presented before correction and commits after maintainer validation. Entry Phémios `2709c1319a972c4b1b5722c94adab04137a30e55`, clean; published Aède v0.7.2 / `168bd4a4a432aed42957c4ff230ea91d77c6c09f` selected through GitHub releases/latest and `node scripts/update-engines.mjs --check`. `node scripts/audio-source.mjs` PASS, exit0; it updates only `Cargo.toml` and the two shared Aède lock entries, then fetches locked dependencies. Ephemeral `phemios-stab-resume-ngstwxh3/source-preparation.log`, SHA-256 `d56b2570c2839a5e190fe5ac2d9a475ce04b481faf711129f38103ae48ae0a9d`. This is preparation, not a test/build or full-gate PASS. Prior v0.6.1 failure logs are historical; the release-availability prerequisite is cleared. Native engine/App compilation, fresh audits, focused/general review records and remaining platform acceptance are recorded only after execution. No commit/push/publication.

### R-PH-FIX-01 and current targeted verification

Independent fresh-context review supports PH-007 and PH-008 with no new confirmed defect; twelve reviewer module tests and separate exact-lease/alias probes PASS. It is focused, not a general clean review. All software contents stayed frozen. The register retains reviewed paths, source identity, refuted hypothesis, report/manifest hashes and platform/resource limits.

| Parent check    | Actual command (repository root)                                       | Result                           | Local log SHA-256                                                  |
| --------------- | ---------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| concerts        | `cargo test -p phemios-core --lib concerts:: --locked --offline`       | PASS25, exit0, no failed/ignored | `960b1eed33baf5a2b3ec4d3f98c668ef36bf731f43e685194cb73d6450eab6d7` |
| native-sessions | `cargo test -p phemios-core --test native_sessions --locked --offline` | PASS83, exit0, no failed/ignored | `984c4543f2846d344037f1aa9b2cfbd7d0951d64849254055d6804c2ff019ffb` |
| native-transfer | `cargo test -p phemios --lib transfer --locked --offline`              | PASS20, exit0, no failed/ignored | `52c098a2180eb32f4ac8b92cb953d2ace756a140ac7402403ba2af8585f95046` |

All three parent commands set `CARGO_INCREMENTAL=0` and `PHEMIOS_REQUIRE_FFMPEG=1`; native transfer sets `PHEMIOS_TRANSFER_ENGINE` to the newly built v0.7.2 sidecar. The parent independently verifies reported artifact hashes; no reviewer Cargo execution is inferred. Official `node scripts/prepare-engine.mjs` PASS, exit0; `engine-preparation.log` SHA-256 `cc457cd50bcec68bc63a2c09cbd07c519f0aec80e81c3b3ff5aa9612f984e81e`. Engine metadata has Aède0.7.2, FlacCompagnon0.9.6 and the selected full audio SHA. This is compilation/preparation plus targeted tests, not a full App or platform-matrix PASS.

## D-PH-15 — Fresh discovery and genuine negative media-admission regressions

Current code base remains `2709c1319a972c4b1b5722c94adab04137a30e55`, published shared/embedded Aède v0.7.2 at `168bd4a4a432aed42957c4ff230ea91d77c6c09f`. R-PH-GEN-01 is nonclean: one new Medium PH-009; independent native discovery additionally confirms Medium PH-010. They were presented before production edits. Corrections are authorized by the ordered resumption; commits still require maintainer validation. The old retained-fix review remains focused evidence, not either member of a general pair.

A separate fresh Test Engineer added regression suites and test-only helpers before either production corrector was released. The parent executed the following commands against unchanged production with only test additions/declarations. Frozen test hashes and original-prefix comparisons are retained in `/tmp/phemios-stab-resume-ngstwxh3/frozen-regressions.json`; passing controls and genuine failing assertions are distinguished. The first named-media attempt overlapped completion of fixture setup and is excluded from the frozen before/after evidence; the final repeat below used stable setup and unchanged production. No assertion was weakened.

| Check                    | Command                                                                                                                                         | Before-fix observed result        | Log SHA256                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| PH009 radio owner        | `node node_modules/vitest/vitest.mjs run src/library/radio-start-owner.test.ts`                                                                 | exit 1; FAIL 9, PASS 13, 22 total | `00824c448e7c0febb7e38efd5fb793444874e75ac32e5f638a06e478b3a4d308` |
| PH010 native core        | `CARGO_INCREMENTAL=0 cargo test -p phemios-core --lib network::tests::media_admission:: --locked --offline -- --nocapture`                      | exit 101; FAIL 4, PASS 2, 6 total | `dab1453bce642893c4c9d606cfd399847d6113bdbcef7a2b1d13677a432beffb` |
| PH010 CD permission      | `CARGO_INCREMENTAL=0 cargo test -p phemios-core --test native_sessions cd_accounts::tests::admin_admission:: --locked --offline -- --nocapture` | exit 101; FAIL 4, PASS 2, 6 total | `c185f21eb5cd2631ba5a5c4aed598a9adceedc072f4a20fa5650e40f40f10ca8` |
| PH010 frontend admission | `node node_modules/vitest/vitest.mjs run src/library/named-media-admission.test.ts`                                                             | exit 1; FAIL 16, PASS 1, 17 total | `d484ce37845b0f294711cf58db9a72067f19f22b82d9def1ec4795af456e44ff` |

Host: macOS arm64, Rust 1.99, Node 26.10, installed locked dependencies, temporary loopback/mock ports. All four suites compile/run: failures are intended behavior assertions, not setup/compile failures. Total 51 new cases, 33 FAIL and 18 PASS controls. No timing-dependent sleeps, real devices, provider calls, personal data or live hearing claims. Later correction/gate results must be recorded separately; these failures are the before-fix evidence rather than current gate failures.

Rust 1.90 was installed from the checksum-verified official installer into an isolated temporary toolchain without changing shell profiles or the ordinary installation. Installation PASS is preparation only, not minimum-version compilation/test evidence. Installer log SHA256 `dd4947280a8fb6a8efa3f5095df78253fc7e1c8f483af6bb556d907b24d6c487`.

## D-PH-16 — Published 0.7.3 C2 revalidation

[Current media-admission validation](media-admission-validation.md) consolidates exact candidates, source/engine coherence, genuine negative/positive regressions, preserved assertions, legitimate old-protocol/type-only fixture adaptations, failed attempts, current full Mac gate, genuine Rust 1.90 host execution and fresh dependency/source assessments. These later results supersede the earlier release-availability blockage for the recorded host/candidate only; Linux/Windows/installer acceptance is not waived.

C2 software fingerprint `bf2faf957cc4dddf8a49d50e58c94a29769201b079473afbae62b5941b444c5d`, 1,304 paths. `bash tools/check.sh` PASS exit 0 (90.23s), 60 Node /1,439 Vitest /550 Rust, none ignored; format/lint/strict builds/components/bridge/engine/Rustfmt/Clippy/Rustdoc/site/native workspace build pass. Actual isolated Rust 1.90 tests PASS 550 and all 441 native build inputs remain identical after frontend-only C2. Fresh npm/Cargo audits0, explicit supplemental GLib/Linux warning retained. PH-009/010/011 are VERIFIED within the recorded C2 software scope after affected-path review and evidence validation; installed/native-platform acceptance is separate. Mac App and workflow-equivalent DMG builds PASS, with read-only image verification and exact packaged main/engine hash match. R-PH-GEN-02 and R-PH-GEN-03 now form the consecutive clean GENERAL pair on identical C2; R-PH-VAL-01 verifies evidence/applicability. PH-C10 PASS, PH-C09 BLOCKED, campaign CONTINUE. No maintainer closure, commit, push or release decision.

## D-PH-17 — Final general pair and evidence disposition

R-PH-GEN-02 and R-PH-GEN-03 are independent fresh GENERAL contexts with distinct primary focuses and selected direct paths in all six agreed partitions. Both freeze on the same 1,304-file C2 software map and report no new confirmed significant or Low defect. Their own module diagnostics and parent-attributed gates are distinguished in the [register](findings.md). R-PH-VAL-01 independently validates the pair and the actual evidence; it supplies no general-review credit. Recording-only document changes do not alter the software candidate. A later substantive software change requires affected-path review/revalidation before relying on this pair.

PH-009/010/011 are VERIFIED within documented C2 software scope. PH-003/006/007/008 remain FIXED — TO VERIFY with finding-specific platform acceptance, not a claim of uncorrected software failures on this Mac. The explicit GLib advisory remains visible; no requirement or exception changes. GEN1-C2 remains an unconfirmed robustness hypothesis, with source-ordering evidence, current UI/reachability counterevidence and maintainer/coordinator follow-up.

Current verdict **CONTINUE**, because PH-C09 is BLOCKED. Obtain actual Linux/Windows native/minimum/App/installer and applicable installed-runtime evidence; then finalize finding/coverage/residual dispositions before a closure decision. Physical/provider/deployment checks remain separately qualified. No campaign closure, commit, push, tag, workflow dispatch or release authorization is inferred. Final parent recording-only checks follow after the frozen validator report and are attributed separately.

### Parent recording-only checks after R-PH-VAL-01

`npm run format:check` PASS, exit 0, 7.62s; log SHA256 `ab3a86b907877582cb8bb401d3de5510871e6457202bf85e2f90aeb594536681`. All ten changed documents are covered. Parent local Markdown validation checks 90 relative link targets and 3 Markdown fragments: no missing target or invalid fragment. This is local authored-link validation, not external URL or installed UI acceptance. `git diff --check` PASS; all thirteen new files also have no whitespace diagnostic. The no-index comparison's ordinary “different file” exit 1 is distinguished from an actual whitespace diagnostic; the initial scratch checker was corrected to make that distinction, with no repository change required.

All 1,304 C2 software hashes remain exact, including root instructions, manifests, source/tests and vendor policies. Eleven frozen regression/declaration paths retain their hashes except the three documented old-protocol/type-only adaptations; all new assertion files and PH-011 fixture bytes remain frozen. HEAD stays `2709c1319a972c4b1b5722c94adab04137a30e55`, branch main, index empty: 27 tracked modifications and 13 new files, ten documents included. No source change follows the full gate/general pair. The final recording of these results is itself checked for format, links and whitespace before handoff. No commit or push.
