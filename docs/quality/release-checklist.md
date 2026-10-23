# Phémios Release and Stabilization Checklist

## Candidate and authority

- Campaign `PH-STAB-001`, initial pass on 2026-10-23, branch `main`.
- Software candidate `397912b95f79d54a3eb23e64dfe589df7e3c03e7`, version 0.1.0; initially clean. The initial pass changed eight quality Markdown files; D-PH-02 also adds the remediation plan and diagnostic source under this directory. D-PH-03 additionally implements the authorized Lot 0 source/tests/docs correction; dependency files remain unchanged.
- Current authority: Lots 0–2 committed through c36149e; Lot 3a committed as 4f18270; Lot 3b implementation/checks/final commit explicitly authorized. No suppression, tag, push or release. Earlier ledgers retain their historical authority/results.
- Host: macOS/Darwin 27.0.0 arm64; Node 26.10.0, npm 11.19.1, Rust/Cargo 1.99.0 Homebrew, cargo-audit 0.22.2. Rust 1.90 and other platforms are not tested.
- FFmpeg and FFprobe 9.0.2 installed. Rust checks set `PHEMIOS_REQUIRE_FFMPEG=1`, `CARGO_INCREMENTAL=0`, `RUSTDOCFLAGS="-D warnings"`. Rust commands use existing locked/offline dependencies.
- Shared audio remains pinned to Aède revision `d8c0f1a8c134b7366da0983367a9f063527085b7`. Existing sidecar metadata says Aède 0.6.1 / FlacCompagnon 0.9.6 and has no audio revision. No rebuilt/coherent current sidecar is claimed.

## 1. Source and findings

- [x] Starting candidate/clean state and actual inspected paths recorded.
- [x] No Aède findings/history or generic FC examples imported as Phémios defects.
- [x] Initial dependency matches and source hypothesis qualified/deduplicated in [findings.md](findings.md).
- [ ] Complete campaign partition coverage and all remaining hypotheses.
- [ ] Resolve significant findings with evidence or permitted explicit dispositions; no Critical waiver.
- [x] PH-007 behavioral regression fails before correction and passes after it; targeted package corrections and the Tungstenite migration are recorded below.

## 2. Automated controls

These current controls incorporate D-PH-10; the first execution ledger below remains historical. Results are for the base commit plus its recorded uncommitted correction and individual profiles. Exact authoritative applicability is in the [scope](audit-scope.md#validation-controls-and-evidence). The partial native compile does not turn full App/installer acceptance green.

| Control                             | Result  | Evidence / limit                                                                                                                                                                        |
| ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PH-C01 complete App gate            | BLOCKED | `tools/check.sh` attempted before each commit; stable Aède v0.6.1 lacks shared crates. Frontend stages PASS; pins/locks unchanged.                                                      |
| PH-C02 formatting/lint              | PASS    | Prettier and oxlint successful; formatting rechecked after quality records finalized.                                                                                                   |
| PH-C03 Node/Vitest                  | PASS    | 60 Node tests + 1,334 Vitest tests in 241 files, no skips/failures reported.                                                                                                            |
| PH-C04 types/frontend/analysis      | PASS    | Strict App/component TypeScript, App build and standalone analysis build successful.                                                                                                    |
| PH-C05 Rust workspace/harness       | PASS    | 520 Rust executions: 111 native + 285 core + 80 native-session harness + 30 CD + 14 transfer. FFmpeg required; no ignored cases.                                                        |
| PH-C06 Rust format/lint/docs        | PASS    | Full workspace format, Clippy all-targets and Rustdoc with warnings denied. Initial native Clippy failure retained, then corrected and rerun.                                           |
| PH-C07 bridge/generated docs/site   | PASS    | Bridge, 450 TS modules, component types/static build, full workspace Rustdoc, bilingual site/local links (26 pages).                                                                    |
| PH-C08 fresh advisory assessment    | PASS    | D-PH-10: npm 0 vulnerabilities; raw Cargo 0 matches/notices; GLib remains explicit in the supplemental local-source assessment. Open warning disposition remains a closure requirement. |
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
