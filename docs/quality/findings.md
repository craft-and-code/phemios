# Phémios Findings Register

## Current campaign

- Campaign: `PH-STAB-001`, initial discovery on 2026-10-23.
- Branch `main`, initial candidate `397912b95f79d54a3eb23e64dfe589df7e3c03e7`; current correction base `14f382a`, version 0.1.0. Lots 0–4 and the D-PH-11 investigation are recorded below; D-PH-12 implements the scoped JamBase correction.
- Initially clean; D-PH-01/02 changed quality records only. D-PH-03 additionally implements the authorized Lot 0 source/tests/documentation correction. Software/dependency fingerprints are checked in the [validation record](release-checklist.md).
- Scope/permissions: [audit-scope.md](audit-scope.md); canonical policy: [README.md](README.md).
- Previous generic `FC-*` rows were examples, not Phémios findings. No Aède finding or historical result is imported.
- Next available identifier: `PH-009`.

## Findings summary

Initial discovery reproduced no destructive transfer. The authorized follow-up now confirms PH-007 on disposable audio fixtures: a watched root returning after preview permits overwrite with replacement enabled. Six dependency records and this transfer defect are recorded below; D-PH-03 has since implemented/revalidated PH-007 pending independent review. A confirmed dependency match establishes the resolved affected version, not exploitation of Phémios. Provisional application severity and confidence limits remain explicit; the original npm **Critical** classifications are preserved historically. D-PH-04 removes their affected package resolutions; D-PH-05 removes rustls-pemfile through Tungstenite. D-PH-08 removes proc-macro-error from both owners; D-PH-10 removes the three retired D-Bus packages through the reviewed keepawake Linux migration. GLib remains explicit in the supplemental source assessment; Linux/independent acceptance is pending. D-PH-11 additionally confirms PH-008: budget lock inheritance can produce false-busy JamBase admission after the owner returns. D-PH-12 implements the std-only lease correction; platform and independent acceptance remain pending.

| ID     | Kind                                             | Severity                       | Confidence                                         | Status            | Summary                                                            |
| ------ | ------------------------------------------------ | ------------------------------ | -------------------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| PH-001 | Dependency advisory correction                   | High (historical)              | HIGH version/audit evidence                        | VERIFIED          | TLS verifier/root packages patched; both matches removed           |
| PH-002 | Dependency advisory correction                   | High (historical provisional)  | HIGH version/audit evidence                        | VERIFIED          | Tokio 1.53.3 removes the targeted unsoundness match                |
| PH-003 | Dependency match / Linux reachability hypothesis | High (provisional)             | HIGH match; LOW affected-call reachability         | FIXED — TO VERIFY | GLib pointer fix backported; Linux validation pending              |
| PH-004 | Dependency advisory correction                   | Upstream Critical (historical) | HIGH version/audit evidence                        | VERIFIED          | DOMPurify 3.4.17 removes all three package matches                 |
| PH-005 | Development-tool advisory correction             | Upstream Critical (historical) | HIGH version/audit evidence                        | VERIFIED          | Storybook 10.6.3 family removes targeted dev-server matches        |
| PH-006 | Maintenance correction                           | Medium (historical)            | HIGH graph/host evidence; Linux pending            | FIXED — TO VERIFY | Retired packages removed; local Linux port awaits acceptance       |
| PH-007 | Conditional transfer data-integrity defect       | High                           | HIGH regression before/after                       | FIXED — TO VERIFY | Retained root admission implemented; independent review pending    |
| PH-008 | Budget lease lifetime                            | Medium (provisional)           | HIGH macOS source/runtime; other platforms pending | FIXED — TO VERIFY | Explicit unlock retires owner; platform/independent checks pending |

## Required detailed record fields

Records retain stable PH ID, kind/title, candidate and dirty state, exact source locations, trigger, expected/actual behavior, impact, severity/confidence, static versus runtime evidence, check results, missing regression evidence, status, correction/review identity and limits. A missing test is not a defect. Package advisory matches are not demonstrated application exploits.

Lifecycle: `TO CONFIRM`, `CONFIRMED`, `IN CORRECTION`, `FIXED — TO VERIFY`, `VERIFIED`, `DEFERRED — DOCUMENTED DECISION`, `REJECTED — RATIONALE RETAINED`. Deduplicate by root failure and retain rejection rationale. No Critical waiver; exceptional High dispositions require explicit maintainer acceptance.

## Detailed records

Original records retain their discovery candidate/locations; D-PH-04 records current targeted package corrections against the committed Lot 0 base. Origin: coordinator discovery `D-PH-01`; D-PH-04/05 supply targeted dependency corrections, without suppression, waiver or independent review. D-PH-03 implements PH-007 only, as recorded below. Owner for next triage: maintainer with coordinating assistant; proposed actions are unexecuted. Current advisory evidence is PH-C08 in the checklist.

### PH-001 — TLS verifier and bundled roots match the emSign distrust advisories

- Kind/status: Dependency advisory matches; `VERIFIED` for the package correction in D-PH-04; original application exploit reachability was not demonstrated.
- Severity/confidence: High (provisional application impact); HIGH for resolved affected versions.
- Locations: `Cargo.lock:3754` (`rustls-webpki 0.103.15`), `Cargo.lock:5466` (`webpki-roots 1.0.9`); `core/src/network.rs:55`, `core/src/network_tls.rs:9`.
- Trigger and expected/actual behavior: A public-trust HTTPS connection is evaluated using an affected verifier/root set. Expected: reject the distrusted intermediate keys. Actual: affected versions are resolved and used by the default ureq/rustls client. The exact loopback-certificate root set in login_pinned is a separate boundary; this finding does not assert that its certificate pin is bypassed.
- Impact: Potential acceptance of a distrusted certificate chain at a network authentication boundary. Both RustSec matches concern the same emSign failure family and are tracked together, not counted as two demonstrated attacks.
- Evidence and limits: `rustls-webpki → rustls → phemios-core` and `webpki-roots → ureq → phemios-core` verified with locked offline cargo tree. PH-C08 reports RUSTSEC-2026-0382 and RUSTSEC-2026-0381. No hostile-chain runtime reproduction or token interception was performed.
- Sources: [RustSec verifier advisory](https://rustsec.org/advisories/RUSTSEC-2026-0382.html), [RustSec roots advisory](https://rustsec.org/advisories/RUSTSEC-2026-0381.html).
- Required investigation/correction and validation: Prepare a narrowly scoped lockfile update to rustls-webpki 0.103.16+ and webpki-roots 1.0.10+ within compatible releases. Re-run audit plus existing correct/wrong-pin HTTPS/WSS tests and add a relevant distrusted-chain fixture when redistribution/fixture provenance is established. No update applied.

- D-PH-04 correction evidence: the accepted patched versions are installed/locked; the targeted advisory IDs no longer match in fresh full audits. Existing TLS/editor/native/tooling suites pass. No ignore/override or broader security certification. See the current execution ledger; historical trigger and severity above are retained.

### PH-002 — Tokio 1.53.2 remains in the native dependency graph

- Kind/status: Dependency match / application reachability hypothesis; `VERIFIED` for the package correction in D-PH-04; original application exploit reachability was not demonstrated.
- Severity/confidence: High (provisional); HIGH match; LOW actual affected-call reachability.
- Locations: `Cargo.lock:4861`; native Tauri/reqwest dependency branches.
- Trigger and expected/actual behavior: Code uses the affected safe AsyncFd constructors with an invalid, closed or replaced descriptor. Expected: I/O lifetime safety. Actual established fact: Tokio 1.53.2 matches RUSTSEC-2026-0386; such a caller has not been established in Phémios or its enabled dependency paths.
- Impact: Potential descriptor lifetime unsoundness. Inventory evidence is confirmed; no application use-after-free or exploit is claimed.
- Evidence and limits: PH-C08 reports an unsoundness warning. `cargo tree --locked --offline -i tokio --target all --depth 3` confirms Tauri/reqwest branches; no dependency implementation audit or fault reproduction completed.
- Sources: [Upstream change](https://github.com/tokio-rs/tokio/pull/8587); advisory RUSTSEC-2026-0386 in the captured RustSec database.
- Required investigation/correction and validation: Trace the affected API on enabled Unix paths; propose compatible Tokio 1.53.3+ resolution without unrelated upgrades. Re-run native checks and session/transfer behavior. Preserve the alert until corrected or supported reachability disposition; no suppression.

- D-PH-04 correction evidence: the accepted patched versions are installed/locked; the targeted advisory IDs no longer match in fresh full audits. Existing TLS/editor/native/tooling suites pass. No ignore/override or broader security certification. See the current execution ledger; historical trigger and severity above are retained.

### PH-003 — GLib 0.18.5 has the VariantStrIter unsoundness warning

- Kind/status: Dependency match / Linux reachability hypothesis; `FIXED — TO VERIFY`.
- Severity/confidence: High (provisional); HIGH match; LOW affected-call reachability.
- Locations: `Cargo.lock:1651`; Linux GTK3/native WebView dependency graph.
- Trigger and expected/actual behavior: The affected VariantStrIter iterator is used, especially in optimized code. Expected: valid C-string/output-pointer handling. Actual established fact: GLib 0.18.5 matches RUSTSEC-2024-0429; affected iterator use in the Phémios Linux host is not demonstrated.
- Impact: Potential undefined behavior/native crash on Linux. macOS test success provides no Linux clearance.
- Evidence and limits: PH-C08 unsoundness warning; the reviewed run is macOS arm64. A compatible GTK3 dependency solution and Linux optimized reproduction remain unverified.
- Sources: [RustSec GLib advisory](https://rustsec.org/advisories/RUSTSEC-2024-0429.html).
- Required investigation/correction and validation: Investigate the Tauri/GTK3 constraint and upstream-compatible backport or migration. Do not force GLib 0.20 into the GTK3 graph or add an ignore. Verify on Linux with the actual native graph before disposition.

- D-PH-07 correction: the published 0.18.5 source is locally patched with upstream #1343 only. Actual optimized old-source SIGSEGV and corrected debug/release public-API passes were recorded on macOS; Linux App/optimized/minimum-version and independent acceptance remain pending. Raw cargo-audit skips the local package, so `npm run audit:dependencies` retains this exact advisory as an explicit upstream affected-version/local-backport record. Macro/D-Bus warnings remain unchanged. [Evidence and remaining Linux checks](lot-3a-validation.md).

### PH-004 — DOMPurify 3.4.16 matches three sanitizer advisories

- Kind/status: Dependency match / application reachability hypothesis; `VERIFIED` for the package correction in D-PH-04; original application exploit reachability was not demonstrated.
- Severity/confidence: High (provisional; upstream Critical retained); HIGH match; LOW exploit reachability.
- Locations: `package-lock.json:4325`; `@milkdown/kit → @milkdown/components → dompurify`; `src/editor/milkdown.ts:1`.
- Trigger and expected/actual behavior: The advisory-specific DOM/template, in-place-hook or XHTML configuration is exercised on attacker-controlled input. Expected: sanitizer contracts hold. Actual: the affected package is installed; the application imports specific Milkdown core/commonmark/history/listener utilities and renders note links/images inertly. No matching dangerous application configuration was established. D-PH-02 additionally inventories the production Vite chunks: zero DOMPurify or @milkdown/components module entries. The installed package match remains open for update; no general clearance for other configurations.
- Impact: npm classifies this package Critical, including GHSA-cg2g-xh64-v4q7, High GHSA-mrv2-3pqr-j5jr and Low GHSA-c6gr-qvv4-5v3f. Do not turn the inventory match into a demonstrated desktop XSS, or hide it because reachability is uncertain.
- Evidence and limits: PH-C08 and npm ls confirm the transitive installed version. Static inspection of the note editor and installed Milkdown component imports only; no browser exploit attempted. SAFE_FOR_TEMPLATES with a DOM-returning mode has not been found in authored app code.
- Sources: [DOMPurify template advisory](https://github.com/advisories/GHSA-cg2g-xh64-v4q7), [in-place advisory](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr), [XHTML advisory](https://github.com/advisories/GHSA-c6gr-qvv4-5v3f).
- Required investigation/correction and validation: Check actual generated bundle/module reachability and all three advisory conditions, then propose a compatible DOMPurify 3.4.17+ resolution through the existing dependency range. Re-run editor inert-content regressions and frontend/docs builds. Do not use an override/ignore solely to make the audit green.

- D-PH-04 correction evidence: the accepted patched versions are installed/locked; the targeted advisory IDs no longer match in fresh full audits. Existing TLS/editor/native/tooling suites pass. No ignore/override or broader security certification. See the current execution ledger; historical trigger and severity above are retained.

### PH-005 — Storybook 10.6.1 development server is affected

- Kind/status: Development-tool dependency exposure; `VERIFIED` for the package correction in D-PH-04; original application exploit reachability was not demonstrated.
- Severity/confidence: High (provisional; upstream Critical retained); HIGH affected version and supported dev command.
- Locations: `package.json:38`, `package.json:44`, `package-lock.json:6562`; `scripts/component-explorer-policy.mjs:5`.
- Trigger and expected/actual behavior: A developer runs the supported component-explorer dev command and opens an attacker-controlled website under the advisory conditions. Expected: origin/admission isolation. Actual: installed Storybook 10.6.1 is in the affected range. Binding to 127.0.0.1 does not by itself address the cross-origin localhost issue.
- Impact: Potential unauthorized developer-project writes/code execution, reported Critical by npm. The upstream advisory distinguishes development servers from static built Storybook; neither an exploited machine nor a desktop production vulnerability is claimed.
- Evidence and limits: PH-C08 reports GHSA-f2ph-cmg5-wxc8 and GHSA-px85-f4q5-jh77; npm ls confirms the 10.6.1 addon/builder family. Only a static build was executed in this campaign, with no Storybook dev server/browser session.
- Sources: [Origin advisory](https://github.com/advisories/GHSA-f2ph-cmg5-wxc8), [local-network advisory](https://github.com/advisories/GHSA-px85-f4q5-jh77).
- Required investigation/correction and validation: Prepare a coherent Storybook/addon/builder patch update to at least 10.6.2 (npm currently suggests 10.6.3), checking Solid adapter peer compatibility and security defaults. Upstream recommends avoiding the affected dev server until patched. Re-run tooling tests, component checks/build and advisory assessment; static output success is not security clearance.

- D-PH-04 correction evidence: the accepted patched versions are installed/locked; the targeted advisory IDs no longer match in fresh full audits. Existing TLS/editor/native/tooling suites pass. No ignore/override or broader security certification. See the current execution ledger; historical trigger and severity above are retained.

### PH-006 — Retired maintenance branches removed, Linux port pending acceptance

- Kind/status: maintenance correction; `FIXED — TO VERIFY`. Package removal is established; the local Linux backend still requires actual Linux/independent acceptance.
- Severity/confidence: historical Medium; HIGH resolved-graph/Unix protocol evidence, no physical Linux acceptance.
- Historical discovery: proc-macro-error 1.0.4, rustls-pemfile 2.2.0, zbus_names 4.3.5, zvariant 5.15.1 and zvariant_derive 5.15.1. Original advisory evidence remains in the earlier ledgers.
- Correction/locations: D-PH-05 removes rustls-pemfile; D-PH-08 removes both macro-error owners. D-PH-10 selects vendor/keepawake/src/sys/linux.rs with zbus 6.1.0; all three retired D-Bus package blocks disappear from Cargo.lock. See [Lot 4 validation](lot-4-validation.md).
- Trigger/expected/actual: the standalone crates are no longer maintained. Their APIs move into zbus 6 rather than being renamed or ignored. The former synchronous API is explicitly adapted with bounded private runtime/cleanup and unchanged inhibition semantics.
- Evidence: checksum-verified published source, exact patch replay, locked all-target sole-owner graph and fresh full/supplemental audits. An old UnInhibit refusal panics in Drop; the corrected actual module passes fourteen private-bus cases on macOS and all-target Clippy with warnings denied. Tests do not contact the workstation buses. No current unmaintained-package warning matches, but local-source maintenance remains an obligation.
- Remaining verification: actual Linux package/native App/desktop/logind/service restart/timer checks, Rust 1.90, Windows and independent review. GLib's separate RUSTSEC-2024-0429 record remains explicit and open; do not infer whole-product audit clearance.

### PH-007 — Returning watched root permits overwrite after preview

- Kind/status: conditional transfer data-integrity defect; `FIXED — TO VERIFY`. D-PH-02 confirmed the old behavior; D-PH-03 implements the fix and automated before/after validation. A fresh independent review remains pending.
- Severity/confidence: **High**; **HIGH** for the reproduced guard/copy boundary. Full Tauri UI, live export endpoints and physical remount not exercised.
- Candidate: starting commit plus the authorized uncommitted Lot 0 source/tests/docs diff; dependencies/locks/source pins unchanged. Exact fingerprints and checks are in the checklist.
- Locations: `crates/phemios-transfer/src/mounted.rs:96`, `src-tauri/src/transfer.rs:218` and `Preview` retained protection at `:54`; `src-tauri/src/transfer_job.rs:130` and `copy` at `:176`.
- Trigger: a watched root beneath the selected destination is unavailable at preview admission, then reappears before copy while the destination directory retains its identity. Replacement is explicitly enabled.
- Expected/actual: refuse a newly overlapping library destination before writing; instead outside() initially skips the unavailable root, Preview does not retain roots, and the per-file callback checks mount/session without repeating source-root admission. The real staging copy can replace another audio file under the now-present watched root.
- Runtime evidence: with verification on and replacement off, differing existing audio is preserved and the copy refuses. With replacement on, copy succeeds and the other watched audio changes to staged bytes. Selected original/staged bytes remain unchanged; repeating outside() would reject overlap in both cases. All paths/audio are disposable fixtures.
- Scope/limits: actual compiled Mounted + exact unmodified private copy helper + real embedded Aède 0.6.1 CLI, with fixture staging. This is a component integration reproduction, not a full UI/server/hardware test or proof that unrelated missing remote roots must block transfer.
- Evidence and reproducibility: [plan, reproduction and digests](remediation-plan.md#ph-007-verification--confirmed-conditional-overwrite); [portable diagnostic source](reproductions/ph-007.py). Local logs `target/quality/PH-STAB-001/PH-007/`; both assertions complete, exit 0.
- Correction and regression: Lot 0 now retains DestinationGuard/Protection in Preview, includes stopped/unselected configured local roots, refuses ambiguous unavailable local overlap, and rechecks configuration/identity/availability and remote overlap before start and after staging/before child writes. The native returning-root overwrite test failed on old code and passes after correction; 11 added cases cover native start, root policy and configuration boundaries. No dependency/suppression change. Full workspace tests/lint/docs/build pass; fresh independent review and other-platform/physical acceptance remain pending.

### PH-008 — Inherited descriptor prolongs a retired JamBase budget lease

- Kind/status: runtime admission/reliability defect; `FIXED — TO VERIFY`. D-PH-12 implements the correction and host regressions; neither the investigation nor this implementation context is independent acceptance.
- Severity/confidence: provisional Medium; HIGH unmodified-test/syscall/actual-API evidence on macOS, other-platform and live-App incidence unmeasured.
- Discovery candidate: clean 14f382a, source/dependencies unchanged during D-PH-11. D-PH-12 adds only the budget lease implementation, sibling tests and supporting documentation; dependencies/pins/policy remain unchanged.
- Historical locations (14f382a): core/src/concerts_budget.rs:12 retained File, at:58–67 acquisition and close-only lifetime; core/src/local.rs:371 configure_concerts / :417 concert_budget. Original test fails at local_tests.rs:301, repeated cases at :300/301. Native concert configuration/request callers share the same Budget.
- Trigger/expected/actual: another process holds a duplicated/inherited reference to the locked file description after the logical Budget owner drops. Expected: that retired owner no longer prevents a new legitimate admission. Actual: try_lock returns EWOULDBLOCK until the remaining reference closes, and key configuration/events can be refused as busy. Genuine concurrent admission must remain blocked.
- Runtime evidence: three failures in fourteen runs of the unchanged parallel local selection; serial 100 runs and two non-spawning JamBase cases 200 runs show no failure. Original-test interposition records flock op=6 / errno=35 with close-on-exec set. Actual public Engine/Budget with an inherited descriptor deterministically refuses after parent drop, preserves the key and usage, then succeeds after child exit. The std-only explicit-unlock control succeeds while the inherited reference remains. [Full isolation/evidence](jambase-lock-plan.md).
- Impact/limits: transient refusal, not demonstrated quota bypass, data corruption, secret exposure or live provider failure. Original historical run had only the generic error; later original-test syscall and controlled ownership reproductions establish the defect. The relevant source predates Lot 4. No real API call or user catalogue is used.
- Required correction: a private successful-acquisition RAII lease calling File::unlock on Drop, installed before journal parsing, with deterministic safe try_clone ownership/error-path tests. Preserve nonblocking true-busy refusal, quotas, privacy and existing test counts; validate all unchanged tests in parallel and across available platforms. No dependency addition expected. The authorized D-PH-12 correction follows that plan; [validation](jambase-lock-validation.md) preserves exact before/after results and limitations.
- D-PH-12 validation: all 25 concert cases and 524 unfiltered workspace Rust cases pass; four new deterministic cases include two recorded failures before the fix. All 15 unchanged local cases pass 200 default-parallel runs; all 15 budget cases pass 100 default-parallel runs. Clippy/Rustdoc/native host build, frontend/tooling and site checks pass. Full gate stops at the unchanged stable-engine prerequisite; dependencies/pins/policy are unchanged.
- Retained alerts: GLib RUSTSEC-2024-0429 remains visible through the supplemental source scan; Linux acceptance and PH-007 independent review remain pending. PH-008 still requires other-platform/minimum-version and independent verification; no green rerun or serial/filtered invocation closes it.

## Discovery and review records

### D-PH-01 — Initial coordinator discovery

Read-only source/test inspection on the starting candidate; this is not an independent post-fix review. Actual coverage:

| Partition             | Inspected paths                                                                                                                                                                                                       | Observations / limitations                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Session admission     | `src-tauri/src/sessions.rs`, `src-tauri/src/personal_backup.rs`; session test cases inspected                                                                                                                         | Exact tickets/client checks and live role probes bracket private mutations; no new confirmed defect in these inspected helpers. Not every IPC caller was traced.                                                                                                                                                                                                   |
| Private IO/backup     | `core/src/private_storage.rs`, `private_documents.rs`, `personal_backup.rs`; private-root and backup test cases inspected                                                                                             | Owner/version/namespace checks, exclusive pending writes, file-mode refusal and additive preflight verified statically. Existing 0755 roots reject writable group/other bits but permit read/search; files require 0600. No demonstrated cross-owner read; do not infer a secret leak from directory modes alone. Crash recovery/OS races not exhaustively tested. |
| Downloads/transfers   | `core/src/download.rs`, `crates/phemios-transfer/src/{lib,mounted,process}.rs`, `src-tauri/src/{transfer_folder,transfer_plan}.rs`; selected planning/job paths in `transfer.rs` and `transfer_job.rs`, mounted tests | New-file export publication, path admission and retained mount identity inspected. Initial PH-007 hypothesis was confirmed in D-PH-02; hardware/real-library publication not exercised.                                                                                                                                                                            |
| Frontend async/editor | `src/library/{annotation-writes,connection}.ts`, annotation writer tests, `src/editor/milkdown.ts`                                                                                                                    | Queued/stale annotations, connection epoch retirement and inert note image/link presentation inspected. Not full context/provider/podcast/UI coverage. PH-004 reachability remains open.                                                                                                                                                                           |
| Network/tooling       | `core/src/network.rs`, `network_tls.rs`, TLS test case; manifests/locks, `tools/check.sh`, engine preparation, Vite, documentation/site/Storybook scripts and native capability/configuration                         | Dependency paths and nonmutating profiles assessed. Actual enabled native call graphs, prebuilt engine internals and system libraries not comprehensively audited.                                                                                                                                                                                                 |

Executed behavior: existing Node/Vitest and Rust core/CD/transfer/native-session suites; checks, builds and generated documentation listed in the checklist. Passing tests do not prove the absence of defects. No code/test additions or corrections, real credentials, live provider calls, real audio output or physical transfer were used. Dependency/advisory network access is separate from provider acceptance.

No qualifying independent review is completed. A separate fresh reviewer/context must directly inspect the candidate and evidence; successive roles in this coordinator context do not qualify as the clean-review pair.

### D-PH-02 — Authorized dependency plan and PH-007 verification

Same coordinator context, not an independent review. Target-specific locked dependency trees identify GLib/GTK3, both proc-macro owners, Tungstenite/native-certs and keepawake/zbus branches. Registry and primary source metadata checked without installing/updating dependencies. [Remediation plan](remediation-plan.md) records compatible candidates, migration constraints and per-lot acceptance.

PH-007 diagnostic ran successfully at `2026-10-23T17:38:07.265573+00:00` using the unchanged copy helper and current embedded engine. The unsafe opt-in replacement case is reproduced; nonreplacement control preserves bytes. Production bundle inventory at `2026-10-23T17:36:55.154Z` shows no DOMPurify/Milkdown-components modules, narrowing PH-004 reachability without hiding its package alert. No independent reviewer, code fix, source pin change or audit waiver.

### D-PH-03 — Lot 0 implementation and coordinator revalidation

The maintainer authorized the production correction, regressions and checks, requesting a commit message rather than a commit. Initial exact-filter run selected zero tests and is not reproduction evidence. The corrected selection ran one native regression against the old code and failed with `copy overwrote audio in the returning watched root` (exit 101). Current native regression and full Rust workspace pass after the fix; logs retain both outcomes.

Changed boundaries: `core/src/local.rs` reads all protected configured roots without exposing credentials; `crates/phemios-transfer/src/guard.rs` retains local root identity/availability and remote hints; native `transfer_roots.rs`, Preview/start and job handoffs preserve that admission. Tests remain in declared sibling files. Eight existing unnecessary closure borrows found by the first full native Clippy run were corrected in the touched job and native aede/notes adapters; no allow attribute or behavioral rewrite.

Coordinator code review and automated revalidation only. No independent review/clean pair or atomic filesystem/hardware guarantee. PH-007 is fixed pending fresh review; all six dependency/maintenance records remain open and fresh audits still fail visibly. See the current Lot 0 execution ledger in the checklist.

### D-PH-04 — Targeted security update revalidation

Lot 1 was authorized and implemented on base `cc1f9fa91092f93790b7b7f505fe8dbed29902aa` (Lot 0 commit `cc1f9fa`). Resolved versions: rustls-webpki 0.103.16, webpki-roots 1.0.10, Tokio 1.53.3, DOMPurify 3.4.17 and Storybook/addon-docs/builder-vite/react-dom-shim 10.6.3. No new direct runtime dependency, override, suppression, broad upgrade or source-pin change. React/react-dom remain 19.3.0; other package versions and Cargo dependency edges retain their prior valid choices. Only the three approved Cargo versions/checksums and five approved npm package versions change. The dependency graph validates with locked/offline Cargo metadata and a clean npm ci --ignore-scripts; npm ls reports no invalid peers.

Fresh npm audit: exit 0, **0 vulnerabilities**. Fresh cargo-audit: exit 0, **0 vulnerability matches**, but **six warnings remain visible**: GLib 0.18.5 unsoundness RUSTSEC-2024-0429; proc-macro-error 1.0.4, rustls-pemfile 2.2.0, zbus_names 4.3.5, zvariant 5.15.1 and zvariant_derive 5.15.1 maintenance notices. PH-003/006 and later migration lots remain open. No clean whole-product security claim: Git source, prebuilt embedded engine and system libraries are not cleared by these lockfile audits.

Verification on macOS arm64 / Rust 1.99 / Node 26: 517 Rust executions, no ignored cases; 1,334 Vitest and 46 Node tests. Full workspace Clippy all-targets/Rustdoc with warnings denied and native build pass; frontend format/lint/build, analysis build, bridge, TS contracts, component types/static build and 26-page site/local link checks pass. Existing correct/wrong-certificate HTTPS/WSS and live loopback original/MP3 transfer tests pass. No new authored runtime code or tests required for these package patches; the audit before/after is the advisory-resolution regression, not a demonstrated hostile-certificate or browser exploit.

All Cargo checks use --locked --offline after an explicit locked fetch. PHEMIOS_REQUIRE_FFMPEG=1, CARGO_INCREMENTAL=0, RUSTDOCFLAGS=-D warnings; PHEMIOS_TRANSFER_ENGINE points to the existing Aède 0.6.1 / FlacCompagnon 0.9.6 binary. No engine preparation/source replacement. The full tools/check.sh was attempted before the Lot 0 commit and stopped on the published v0.6.1 missing shared crates, with no manifest/lock changes; it is not falsely reported as a successful full gate for Lot 1. Rust 1.90, Linux/Windows, installers, real-device and independent reviews remain unexecuted.

Coordinator package/evidence review, not an independent adversarial review. Current package corrections PH-001/002/004/005 are VERIFIED for their inventory/advisory scope. PH-003/006 remain open and PH-007 awaits independent review. No campaign closure or Lot 1 commit.

## Next sequence and remaining limits

1. PH-001/002/004/005 package corrections are verified. Continue the separately authorized future migration lots for PH-003/006 without suppressions.
2. Obtain fresh independent review of the implemented PH-007 correction; automated native before/after and adjacent regression evidence now pass.
3. Apply only separately accepted fixes with behavioral before/after evidence; retain all warning classes.
4. Complete coherent embedded-engine preparation, full native tests/builds and Rust 1.90/Linux/Windows matrix; current macOS check is not installer acceptance.
5. Obtain two qualifying independent reviews after affected revalidation. Hardware/live-provider acceptance remains explicit.

Current recommendation: `FIX AND REVALIDATE` because GLib/maintenance dispositions, full engine preparation and independent review remain open; discovery and independent reviews also remain incomplete. No campaign closure, commit or release approval.

### D-PH-05 — Tungstenite revalidation

Lot 1 was committed as f4cedb3. Lot 2 is checked against that base: Tungstenite 0.30.0 / rustls-native-certs 0.8.5 removes rustls-pemfile and RUSTSEC-2025-0134 from the full lock graph. PH-006 remains CONFIRMED for the other four maintenance notices; PH-003 GLib unsoundness remains visible. No ignore/policy exception, source-pin replacement or feature removal. 520 Rust executions, 1,334 Vitest and 46 Node pass; all prior Rust test names retained, three real-socket regressions added, wrong-pin WSS refusal extended. Native build/Clippy/Rustdoc pass. The required full gate reaches the known missing-shared-crates stable-engine blocker with pins/locks unchanged. Exact evidence and unexecuted platform/independent acceptance are in the checklist; no campaign closure or release claim.

### D-PH-07 — GLib soundness backport, Linux acceptance pending

The maintainer authorized implementing/checking/committing Lot 3a. Published GLib 0.18.5 is retained with a verified local upstream pointer correction. Eight real GLib API regressions reproduce the old release-mode SIGSEGV and pass after the fix on macOS. PH-003 is source-corrected pending Linux/native/minimum/independent validation, not whole-product clearance. All four maintenance notices remain unchanged; the GLib upstream advisory is retained in the explicit local-source assessment instead of silently disappearing from cargo-audit. The complete implementation/verification scope is [Lot 3a validation](lot-3a-validation.md). Lot 3b remains unimplemented.

### D-PH-08 — Macro diagnostic ports, Linux acceptance pending

Same coordinator context, not independent acceptance. Both published 0.18 macro sources are checksum-inventoried and ported to Syn diagnostics. The old malformed-flags macro panic is reproduced before correction; 25 macro Rust cases (all 21 upstream cases preserved; one additional interface-registration and three GTK cases) and 13 explicit compiler refusals pass afterwards. proc-macro-error/proc-macro-error-attr and unused Syn 1 are removed from the real graph. Three D-Bus notices and the explicit GLib record remain visible; Linux/native/minimum-toolchain acceptance and the separate stable-engine prerequisite remain pending. [Validation](lot-3b-validation.md) and the execution ledger distinguish checks from acceptance.

### D-PH-09 — keepawake/zbus investigation, no dependency change

After clean Lot 3b commit 8eedcbe, the maintainer requests the Lot 4 proposal. Locked all-target tree confirms keepawake 0.6.1 is the sole zbus 5.19.0 owner. Registry/upstream source confirms no published keepawake migration, published zbus 6.1.0 / declared Rust 1.89, and removal of the blocking API used by keepawake. Static inspection identifies an un_inhibit unwrap in Drop and partial-acquisition/runtime/deadline cases requiring Linux tests; no native crash or migrated backend execution is claimed. PH-006's three notices remain open and GLib's supplemental warning remains visible. [Options and implementation/acceptance plan](lot-4-plan.md). Only quality documentation changes in this phase.

### D-PH-10 — Linux keepawake migration, acceptance pending

The maintainer authorizes the source port, tests, checks and final commit. Local keepawake 0.6.1 uses zbus 6.1.0 / existing Tokio 1.53.3, with reviewed archive/base-revision provenance and no invented upstream fix. Fourteen private-bus actual-module tests cover lifetimes, partial failures, deadlines and no-panic cleanup after reproducing the old refusal panic. The three notices disappear by real dependency removal; GLib stays explicitly assessed. Mac/Windows source bytes and compatible retained resolutions are preserved. [Validation and remaining Linux work](lot-4-validation.md). No independent or release approval is claimed.

### D-PH-11 — JamBase lock inheritance, investigation only

The maintainer authorizes diagnosis and a plan before modifying code. [PH-008 investigation](jambase-lock-plan.md) confirms an actual lease-lifetime defect through unmodified-test parallel reproduction, errno-preserving original-test tracing and controlled public APIs. The correction remains proposed. No production/test/dependency/pin/policy edit or commit; fresh source assessment retains GLib explicitly. Prior full-suite PASS does not close the new finding.

### D-PH-12 — JamBase successful-owner lease correction

The maintainer authorizes implementation, tests, verification and commit. Two deterministic regressions first fail on close-only ownership; the private explicit-unlock guard then covers normal return, journal-construction errors and unwinding. Four new tests preserve real contention, refused admission, charged usage and successor ownership while a retired duplicate exists. The [validation record](jambase-lock-validation.md) records execution results; dependencies/advisory policy remain unchanged. PH-008 is fixed pending remaining platform and independent verification, not whole-campaign closure.
