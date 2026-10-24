# PH-STAB-001 — Audit Scope

Current validation candidate: published Aède **v0.7.3**, exact source `85a557681d1a86a851e4e1cb4f806b41adbfcd87`, selected after its actual publication at 2026-10-24T09:53:46Z. Earlier v0.7.2 discovery/review/before-fix evidence below remains historical and exactly attributed. Source preparation changes only the two shared crate versions/revisions; embedded-engine compilation and applicable gates are recorded separately. The stable selection is frozen per validation cycle; an in-progress local release is never substituted.

## Campaign information and authorization

- Project: Phémios, version 0.1.0.
- Campaign: `PH-STAB-001`, initial general stabilization campaign.
- Branch: `main`.
- Starting commit: `397912b95f79d54a3eb23e64dfe589df7e3c03e7`.
- Initial working tree: clean.
- Date: 2026-10-23 (Europe/Paris).
- Authority: the maintainer explicitly requested adapting Aède's English quality framework and then starting the campaign.
- Historical campaign phase D-PH-13 authorized the published-Aède prerequisite investigation at Phémios 64e5858 / Aède 19aec35a, with documentation/read-only diagnostics only; its original boundaries remain recorded below. An earlier 2026-10-24 request, already fulfilled before entry commit 2709c13, authorized committing then-pending Phémios work including its 0.7.1 pin, without an App rebuild or publication. That completed approval is historical; current resumption permissions below require final maintainer validation before new commits and authorize the separately recorded App/gate work. No suppression or campaign closure is inferred.

The initial audit is already authorized. Do not reproduce Aède's historical preparation-only restriction as a request for another approval. Confirm findings before proposing corrections; later correction and release decisions remain separate. No general campaign closure or independent clean-review pair is claimed by this first pass.

## Resumption authority and initial 0.7.2 plan (historical, 2026-10-24)

The maintainer authorizes the proposed ordered PH-STAB-001 resumption: refresh the candidate from the latest actually published stable Aède, independently review retained corrections in fresh contexts, complete the remaining general discovery, execute applicable gates and obtain qualifying general reviews when the candidate is ready. Present new confirmed defects before correction; retain maintainer validation before commits. No push, tag, workflow dispatch, publication or advisory suppression is authorized. Necessary upstream corrections may be proposed, preserving the separate active Aède checkout and its in-progress release work.

The following entry plan records the initial 0.7.2 selection. Published 0.7.3 C2 and executed host controls now supersede its then-pending checks; [current validation](media-admission-validation.md) is authoritative for actual results.

Entry candidate is clean `main`, `2709c1319a972c4b1b5722c94adab04137a30e55`, with 1,463 tracked/unignored regular files inventoried. GitHub releases/latest and the existing Phémios selector independently identify published non-draft/non-prerelease `v0.7.2`, exact commit `168bd4a4a432aed42957c4ff230ea91d77c6c09f`. The official `scripts/audio-source.mjs` preparation succeeds and changes only the workspace revision and the two shared package lock entries from 0.7.1 to 0.7.2; unrelated resolutions and all local vendor policies remain unchanged. This clears the historical release-availability prerequisite, not PH-C01 itself. The engine/App still require actual compilation and tests on this candidate.

Freeze this verified published selection for one validation/review cycle using the existing `AEDE_AUDIO_RELEASE` mechanism; do not silently adopt a newer release midway through reviewed checks. At the start of a later candidate cycle, resolve the latest published stable release again. A draft, prerelease, local branch or in-progress 0.7.3 is not eligible. If a necessary upstream fix is found, report it and validate its eventual published release as a new candidate; do not substitute the dirty sibling checkout.

PH-001–PH-008 and all prior ledgers remain historical evidence, not fresh candidate passes. First independently examine PH-007 transfer-root admission and PH-008 JamBase lease lifetimes, then extend the risk-path audit across persistence, exact source/account ownership, IPC, asynchronous frontend publication, audio and transfers. PH-003/PH-006 Linux acceptance, Rust 1.90/native matrix, installers and two general clean reviews remain outstanding until evidence is recorded. The full App gate is now authorized, including its controlled engine preparation, without any exception expansion.

## Objectives and invariants

1. Follow exact source/account/session ownership through native IPC, asynchronous frontend publication, caches, private documents and playback.
2. Investigate preservation of retained data, bounded untrusted input, file export/transfer and interruption/error paths.
3. Verify coverage with actual current-candidate executions rather than importing historical counts.
4. Separate Phémios defects from missing Aède capabilities, provider failures and unexecuted native/hardware acceptance.

Phémios is a client: SolidJS/TypeScript presentation and typed IPC in `src/`, framework-independent policy in `core/`, native wiring in `src-tauri/`, and CD/transfer libraries in `crates/`. Aède retains catalogue/query/account/copy/PCM domain authority. Preserve original audio/tags, process-only credentials, owner-private state, public catalogue sharing, source-qualified identities, cancelled/stale work retirement and explicit unsupported behavior. Ordinary offline navigation must not fetch enrichment.

## Included components

| Partition                       | Paths and principal risks                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native admission and transport  | `src/platform/desktop.ts`, `core/src/network*.rs`, `core/src/server_profile.rs`, `src-tauri/src/sessions.rs`, `aede.rs`, `local*.rs`; TLS, exact generation, authority and role admission |
| Private persistence and backup  | `core/src/private_storage.rs`, `private_documents.rs`, podcast/article stores, `personal_backup.rs`, native adapters; refusal preserves old bytes, owner/version/namespace and safe paths |
| Frontend asynchronous ownership | `src/library/`, source/session providers, podcasts/encyclopedia and annotation/preferences workflows; stale responses, queued mutations and disposal                                      |
| Playback and external media     | `core/src/playback/`, `core/src/hqplayer/`, native routing, `src/network-audio/`, `crates/phemios-cd/`; Stop/logout/preparation ownership, bounded PCM and explicit output capabilities   |
| Downloads and transfers         | Core/native downloads and exports, `crates/phemios-transfer/`, native transfer planning/jobs; destination confinement, overwrite/cancellation and failure-preserving publication          |
| Tooling and integration         | Existing tests, `scripts/`, `tools/check.sh`, native capabilities, release configuration, docs/site and dependency manifests/locks                                                        |

These are campaign partitions, not a statement that every file was reviewed. Each discovery/review record must name the paths actually inspected and disclose omissions.

## Exclusions and separate acceptance

- No exhaustive audit of Aède, FlacCompagnon, external libraries, OS services or provider implementations. Inspect client-facing contracts and record exact pinned sources.
- No live provider calls, real personal library, real credentials, real exports into user folders or physical transfer/playback during discovery. Use existing temporary fixtures and loopback servers.
- Physical sound quality/bit-perfect output, real receivers, HQPlayer/device interoperability, optical drives and MTP/iPod hardware require dedicated acceptance. Phémios's remote f32 route must not be advertised as strict bit-perfect.
- macOS execution is not Linux/Windows/MSRV verification. Missing mandatory native/software evidence remains blocking; hardware limits cannot excuse it.

## Baseline changes and limitations (historical discovery)

The baseline includes shared audio, stable-source engine preparation, exact native session tickets, private document/backup isolation, restored process sessions, HQPlayer generation ownership, parental admission and retained search/draft cancellation. At discovery, current-state described historical frontend/core/harness checks without full native App/packaging evidence. Do not count those old results as new executions. Later C2 Mac gate/Rust 1.90/App/DMG evidence is recorded separately; native Linux/Windows and installed/physical acceptance still require their own controls.

The full gate invokes `scripts/prepare-engine.mjs`, whose automatic stable-source selection can update manifests/locks and needs a published Aède release containing the shared crates. Do not run that mutating preparation during the read-only phase. Inspect its prerequisite and record the full gate/native build as NOT RUN or BLOCKED with evidence rather than changing the selected dependency or silently using a sibling checkout. An isolated locked/offline host check may run without engine preparation; its result does not validate the full gate.

## Validation controls and evidence

Execute only within the current phase. All commands come from actual project scripts or documented individual profiles; use `--locked --offline` for nonmutating Rust discovery checks. Dependencies are not automatically fetched or updated to clear failures. Commands run from the project root, with sanitized logs under ignored `target/quality/PH-STAB-001/`. Record host/toolchain, candidate, command, exit status, counts/skips, log digest and relevant prerequisites.

| ID     | Mandatory software control                                    | Command / evidence                                                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PH-C01 | Complete App gate, including native host and embedded engine  | `bash tools/check.sh`; separately account for automatic source selection before authorization                                                                                                                                                                         |
| PH-C02 | Frontend formatting/lint                                      | `npm run format:check`; `npm run lint`                                                                                                                                                                                                                                |
| PH-C03 | Tooling and frontend behavior                                 | `npm test` (Node then Vitest)                                                                                                                                                                                                                                         |
| PH-C04 | Strict App/component TypeScript, frontend and analysis builds | `npx --no-install tsc --noEmit`; `npx --no-install tsc --noEmit -p docs/components/tsconfig.json`; `npm run build`; `npm run analysis:build`                                                                                                                          |
| PH-C05 | Rust core, native-session harness, CD and transfer behavior   | `PHEMIOS_REQUIRE_FFMPEG=1 cargo test -p phemios-core -p phemios-cd -p phemios-transfer --locked --offline`; record the actual FFmpeg/FFprobe prerequisite                                                                                                             |
| PH-C06 | Rust formatting, lint and docs                                | `cargo fmt --all -- --check`; `cargo clippy -p phemios-core -p phemios-cd -p phemios-transfer --all-targets --locked --offline -- -D warnings`; `RUSTDOCFLAGS="-D warnings" cargo doc -p phemios-core -p phemios-cd -p phemios-transfer --no-deps --locked --offline` |
| PH-C07 | Bridge coherence and generated/frontend/site documentation    | `npm run check:tauri`; `npm run docs:ts`; `npm run components:check`; `node scripts/build-site.mjs --reuse-technical`; `node scripts/check-site.mjs dist-site`                                                                                                        |
| PH-C08 | Fresh dependency advisory assessment                          | `cargo audit --json --file Cargo.lock`; `npm audit --json --audit-level=low`; report Git/native/system coverage limits and visible maintenance/unsoundness findings                                                                                                   |
| PH-C09 | Native/minimum-version matrix and packaging                   | Native Rust 1.90 baseline, macOS/Linux/Windows App builds/tests and installer evidence; no fabricated cross-platform pass                                                                                                                                             |
| PH-C10 | Regression and independent review evidence                    | Before/after behavior for accepted corrections; two consecutive qualifying independent reviews under README rules                                                                                                                                                     |

PH-C01/C09 are required for general closure even if the initial discovery uses individual non-native profiles. In a selected targeted pass, do not conflate its green controls with the entire campaign. Browser/native/hardware/provider acceptance is recorded separately; no fixture or snapshot supplies acoustic or physical-device evidence.

## Initial review and outcome (historical)

- Discovery context: the coordinating assistant, not an independent adversarial reviewer.
- Independent reviewers: not yet assigned; no independent review or clean pair completed.
- Findings: see the register; no inherited `AE-*` or `FC-*` record is adopted.
- Current recommendation after initial discovery: `FIX AND REVALIDATE` because advisory assessment PH-C08 fails. See the register/checklist for current evidence and unresolved coverage.
- Release authorization: not granted by this campaign launch. No commits, tags or publication are requested here.

## Authorized follow-up — dependency plan and PH-007 verification

The maintainer subsequently requested a dependency remediation plan and verification of the transfer hypothesis without masking alerts. Read-only graph/source research, production bundle inventory and a disposable reproduction are completed as D-PH-02. PH-007 is now confirmed for a returning watched root with explicit replacement. The [plan](remediation-plan.md) and register retain evidence/limits; no production code, test, dependency or suppression change authorized or performed by this follow-up.

## D-PH-03 — Authorized Lot 0 correction

The maintainer explicitly authorized implementing Lot 0, adding tests and running verification while keeping dependency alerts visible. That authorization supersedes the earlier read-only phase for PH-007 only. The permanent native regression failed with an actual temporary-file overwrite before the correction. Retained source-qualified root admission now spans preview/start/file handoff, with configured local roots protected independently of selected origin. No dependency correction or suppression is included. Verification/limits live in the checklist; no independent reviewer or release is claimed.

## D-PH-04 — Authorized Lot 1

Lot 1 was authorized and implemented on base `cc1f9fa91092f93790b7b7f505fe8dbed29902aa` (Lot 0 commit `cc1f9fa`). Resolved versions: rustls-webpki 0.103.16, webpki-roots 1.0.10, Tokio 1.53.3, DOMPurify 3.4.17 and Storybook/addon-docs/builder-vite/react-dom-shim 10.6.3. No new direct runtime dependency, override, suppression, broad upgrade or source-pin change. React/react-dom remain 19.3.0; other package versions and Cargo dependency edges retain their prior valid choices. Only the three approved Cargo versions/checksums and five approved npm package versions change. The dependency graph validates with locked/offline Cargo metadata and a clean npm ci --ignore-scripts; npm ls reports no invalid peers.

Fresh npm audit: exit 0, **0 vulnerabilities**. Fresh cargo-audit: exit 0, **0 vulnerability matches**, but **six warnings remain visible**: GLib 0.18.5 unsoundness RUSTSEC-2024-0429; proc-macro-error 1.0.4, rustls-pemfile 2.2.0, zbus_names 4.3.5, zvariant 5.15.1 and zvariant_derive 5.15.1 maintenance notices. PH-003/006 and later migration lots remain open. No clean whole-product security claim: Git source, prebuilt embedded engine and system libraries are not cleared by these lockfile audits.

Verification on macOS arm64 / Rust 1.99 / Node 26: 517 Rust executions, no ignored cases; 1,334 Vitest and 46 Node tests. Full workspace Clippy all-targets/Rustdoc with warnings denied and native build pass; frontend format/lint/build, analysis build, bridge, TS contracts, component types/static build and 26-page site/local link checks pass. Existing correct/wrong-certificate HTTPS/WSS and live loopback original/MP3 transfer tests pass. No new authored runtime code or tests required for these package patches; the audit before/after is the advisory-resolution regression, not a demonstrated hostile-certificate or browser exploit.

All Cargo checks use --locked --offline after an explicit locked fetch. PHEMIOS_REQUIRE_FFMPEG=1, CARGO_INCREMENTAL=0, RUSTDOCFLAGS=-D warnings; PHEMIOS_TRANSFER_ENGINE points to the existing Aède 0.6.1 / FlacCompagnon 0.9.6 binary. No engine preparation/source replacement. The full tools/check.sh was attempted before the Lot 0 commit and stopped on the published v0.6.1 missing shared crates, with no manifest/lock changes; it is not falsely reported as a successful full gate for Lot 1. Rust 1.90, Linux/Windows, installers, real-device and independent reviews remain unexecuted.

The four targeted advisory records have verified package corrections; PH-003/006 and independent closure requirements remain open. No Lot 1 commit, tag or push.

## D-PH-05 — Authorized Tungstenite migration and commits

The maintainer explicitly authorized the Lot 1 commit, then implementing/checking/committing Lot 2 while retaining every other alert. Lot 1 is f4cedb3; Lot 2 starts from f4cedb327568a9bf477ccc8d891f973d5c335145. Only the existing Tungstenite transport, required transitive graph, sibling tests and supporting documentation are in scope. No dependency warning suppression, shared-engine pin replacement, Lot 3/4 migration, push, release or independent-review claim. Current validation and residual limits supersede earlier historical phase snapshots in the final checklist section.

## D-PH-06 — Lot 3 investigation before modification

The [Lot 3 proposal](lot-3-plan.md) records current registry/native-owner constraints, exact upstream backports, the archived replacement, scanner source-coverage diagnostics and planned Linux acceptance. Fresh actual lockfile audit retains all five warnings. Source/lock SHA-256 fingerprints remain identical to c36149e. Synthetic registry/path scanner fixtures are isolated outside the repository and do not clear the product audit. No implementation, independent review or commit in this phase.

## D-PH-07 — Authorized GLib backport

Lot 3a implementation, tests, possible checks and a final commit are explicitly authorized by the maintainer. The [validation record](lot-3a-validation.md) preserves the real optimized old-source failure, corrected host-library checks, source integrity and all visible advisories. No other resolved dependency is upgraded; test-only/tooling controls do not waive Linux or whole-campaign acceptance.

## D-PH-08 — Authorized macro diagnostic backports

The maintainer authorizes Lot 3b implementation, tests, available checks and a final commit, preserving other warnings. [Validation](lot-3b-validation.md) records exact published-source ports, preserved upstream suites, new diagnostic regressions and remaining Linux/native/minimum-toolchain acceptance. The later Lot 4 request permits investigation and a plan before modifying those dependencies; this lot leaves keepawake/zbus unchanged.

## D-PH-09 — Lot 4 investigation before dependency modification

The maintainer requests solutions and a plan for keepawake/zbus while retaining other warnings. The [proposal](lot-4-plan.md) confirms the sole Linux owner, current releases, removed blocking APIs, runtime/lifetime implications, cleanup risks, options and test/acceptance requirements. This planning phase changes only quality documentation and starts after the clean Lot 3b commit 8eedcbe. No migration, upstream message, push or release is authorized.

## D-PH-10 — Authorized Linux keepawake migration

The maintainer explicitly approves implementing zbus 6.1.0 in keepawake's Linux backend, adding tests, running available checks, retaining other alerts, naming pending Linux acceptance and committing. [Validation](lot-4-validation.md) records exact published-source provenance, scoped graph changes, old-source release panic, fourteen actual-module/private-bus cases and acceptance limits. No upstream publication/message, push or release is authorized.

## D-PH-11 — JamBase failure investigation before code changes

The maintainer requests the cause and a correction plan, retaining other alerts. [Investigation and proposal](jambase-lock-plan.md) records unchanged-test stress, isolated lock inheritance, original-test syscall tracing and the proposed std-only RAII correction. PH-008 is confirmed, not corrected. Diagnostics use fictional temporary roots/keys without provider traffic, and never install the interposer globally. Source/dependency fingerprints remain unchanged; only documentation is edited.

## D-PH-12 — Authorized JamBase lease correction

The maintainer authorizes the [reviewed plan](jambase-lock-plan.md), sibling regression tests, available verification and a final commit. A private std-only lease explicitly unlocks successful ownership before handle close, including journal-construction errors and unwinding. No dependency, journal schema, quota, API, provider policy or advisory exception changes. [Validation and limits](jambase-lock-validation.md) retain before/after results and pending platform/independent acceptance.

## D-PH-13 — Published Aède gate prerequisite investigation

The [recovery plan](engine-gate-plan.md) follows the actual published-stable resolver through the missing shared crate to the failed Aède v0.7.0 Windows release jobs and skipped publication. The tag exists, but no 0.7.0 release/draft is present. Fifteen existing preparation-policy tests pass; the next correction is upstream Windows validation and an approved stable publication, then a reviewed client source update. No dependency changes or alert suppression are performed.

## D-PH-18 — PH-C09 validation-kit preparation

The maintainer approves the detailed Linux/Windows plan and requests scripts, tests and validation documentation in fresh contexts, without commit or push. Preparation is scoped to the four scripts and three test files in the exact [kit overlay](ph-c09-validation.md#kit-and-cli-contract), and the five quality records `ph-c09-validation.md`, `README.md`, `audit-scope.md`, `findings.md`, `release-checklist.md`. The exact test paths are `tests/ph-c09.test.mjs`, `tests/ph-c09-runner.test.mjs` and `tests/ph-c09-fixtures.mjs`; the enumeration is authoritative. No production source/tests, configuration, lock/vendor policy, root instructions or current-state change is included. No new finding is created merely for tooling readiness.

Product baseline is `main` at `a08821d8a0b28662035c3988e6c1dae2485380fc`; official Aède 0.7.3 at `85a557681d1a86a851e4e1cb4f806b41adbfcd87` remains frozen for this cycle and supplies both shared crates and embedded engine. Original reviewed product inputs and the new kit overlay are identified separately; the historical 1,304-file C2 aggregate is not the aggregate of the expanded current tree. GEN02/03 retain applicability to the unchanged reviewed product, subject to explicit assessment of any later substantive delta; they do not review these tools. A separate focused tooling review is appropriate, with no automatically required third general product review.

[PH-C09 procedures](ph-c09-validation.md) cover Ubuntu 22.04 x86_64 GNU plus a Fedora-compatible RPM acceptance VM, native Windows 11 x64 MSVC, genuine stable/1.90.0 full gates, required FFmpeg/FFprobe, fresh raw/supplemental audits, same-source engine and actual platform installers. Mac export uses a bundle of the frozen product plus a separate archive of the uncommitted exact kit; the bundle alone is insufficient. The runner does not install tools/apps, restart desktop services, launch an App or mark manual acceptance complete. Native execution and any later installation/service manipulation require the designated disposable host procedure; no such action is claimed in this preparation.

PH-C09 remains **BLOCKED**, PH-003/006/007/008 remain **FIXED — TO VERIFY**, and the campaign remains **CONTINUE**. Actual separately attributed portable checks and focused R-PH-C09-KIT-01 review are recorded in the checklist/register; they do not supply native or GENERAL credit. This phase itself supplies no Linux/Windows/minimum/installer/runtime PASS, no new general review, no campaign closure and no release authorization.
