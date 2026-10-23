# Phémios Findings Register

## Current campaign

- Campaign: `PH-STAB-001`, initial discovery on 2026-10-23.
- Branch `main`, initial candidate `397912b95f79d54a3eb23e64dfe589df7e3c03e7`; current Lot 1 base `cc1f9fa91092f93790b7b7f505fe8dbed29902aa`, version 0.1.0 plus the recorded targeted uncommitted dependency/doc diff.
- Initially clean; D-PH-01/02 changed quality records only. D-PH-03 additionally implements the authorized Lot 0 source/tests/documentation correction. Software/dependency fingerprints are checked in the [validation record](release-checklist.md).
- Scope/permissions: [audit-scope.md](audit-scope.md); canonical policy: [README.md](README.md).
- Previous generic `FC-*` rows were examples, not Phémios findings. No Aède finding or historical result is imported.
- Next available identifier: `PH-008`.

## Findings summary

Initial discovery reproduced no destructive transfer. The authorized follow-up now confirms PH-007 on disposable audio fixtures: a watched root returning after preview permits overwrite with replacement enabled. Six dependency records and this transfer defect are recorded below; D-PH-03 has since implemented/revalidated PH-007 pending independent review. A confirmed dependency match establishes the resolved affected version, not exploitation of Phémios. Provisional application severity and confidence limits remain explicit; the original npm **Critical** classifications are preserved historically. D-PH-04 removes their affected package resolutions; the six remaining Rust warning records stay visible.

| ID     | Kind                                             | Severity                       | Confidence                                   | Status            | Summary                                                         |
| ------ | ------------------------------------------------ | ------------------------------ | -------------------------------------------- | ----------------- | --------------------------------------------------------------- |
| PH-001 | Dependency advisory correction                   | High (historical)              | HIGH version/audit evidence                  | VERIFIED          | TLS verifier/root packages patched; both matches removed        |
| PH-002 | Dependency advisory correction                   | High (historical provisional)  | HIGH version/audit evidence                  | VERIFIED          | Tokio 1.53.3 removes the targeted unsoundness match             |
| PH-003 | Dependency match / Linux reachability hypothesis | High (provisional)             | HIGH match; LOW affected-call reachability   | TO CONFIRM        | GLib 0.18.5 has the VariantStrIter unsoundness warning          |
| PH-004 | Dependency advisory correction                   | Upstream Critical (historical) | HIGH version/audit evidence                  | VERIFIED          | DOMPurify 3.4.17 removes all three package matches              |
| PH-005 | Development-tool advisory correction             | Upstream Critical (historical) | HIGH version/audit evidence                  | VERIFIED          | Storybook 10.6.3 family removes targeted dev-server matches     |
| PH-006 | Maintenance risk                                 | Medium                         | HIGH inventory; runtime consequence unproven | CONFIRMED         | Five unmaintained Rust packages remain visible                  |
| PH-007 | Conditional transfer data-integrity defect       | High                           | HIGH regression before/after                 | FIXED — TO VERIFY | Retained root admission implemented; independent review pending |

## Required detailed record fields

Records retain stable PH ID, kind/title, candidate and dirty state, exact source locations, trigger, expected/actual behavior, impact, severity/confidence, static versus runtime evidence, check results, missing regression evidence, status, correction/review identity and limits. A missing test is not a defect. Package advisory matches are not demonstrated application exploits.

Lifecycle: `TO CONFIRM`, `CONFIRMED`, `IN CORRECTION`, `FIXED — TO VERIFY`, `VERIFIED`, `DEFERRED — DOCUMENTED DECISION`, `REJECTED — RATIONALE RETAINED`. Deduplicate by root failure and retain rejection rationale. No Critical waiver; exceptional High dispositions require explicit maintainer acceptance.

## Detailed records

Original records retain their discovery candidate/locations; D-PH-04 records current targeted package corrections against the committed Lot 0 base. Origin: coordinator discovery `D-PH-01`; no dependency correction/suppression, maintainer waiver or independent review has occurred. D-PH-03 implements PH-007 only, as recorded below. Owner for next triage: maintainer with coordinating assistant; proposed actions are unexecuted. Current advisory evidence is PH-C08 in the checklist.

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

- Kind/status: Dependency match / Linux reachability hypothesis; `TO CONFIRM`.
- Severity/confidence: High (provisional); HIGH match; LOW affected-call reachability.
- Locations: `Cargo.lock:1651`; Linux GTK3/native WebView dependency graph.
- Trigger and expected/actual behavior: The affected VariantStrIter iterator is used, especially in optimized code. Expected: valid C-string/output-pointer handling. Actual established fact: GLib 0.18.5 matches RUSTSEC-2024-0429; affected iterator use in the Phémios Linux host is not demonstrated.
- Impact: Potential undefined behavior/native crash on Linux. macOS test success provides no Linux clearance.
- Evidence and limits: PH-C08 unsoundness warning; the reviewed run is macOS arm64. A compatible GTK3 dependency solution and Linux optimized reproduction remain unverified.
- Sources: [RustSec GLib advisory](https://rustsec.org/advisories/RUSTSEC-2024-0429.html).
- Required investigation/correction and validation: Investigate the Tauri/GTK3 constraint and upstream-compatible backport or migration. Do not force GLib 0.20 into the GTK3 graph or add an ignore. Verify on Linux with the actual native graph before disposition.

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

### PH-006 — Five unmaintained Rust packages remain visible

- Kind/status: Maintenance risk; `CONFIRMED`.
- Severity/confidence: Medium; HIGH inventory; runtime consequence unproven.
- Locations: `Cargo.lock:3373` proc-macro-error 1.0.4; `:3736` rustls-pemfile 2.2.0; `:6112` zbus_names 4.3.5; `:6224` zvariant 5.15.1; `:6239` zvariant_derive 5.15.1.
- Trigger and expected/actual behavior: A future bug/platform change needs an upstream fix. Expected: maintained support or an explicit risk decision. Actual: the fresh database reports RUSTSEC-2024-0370, RUSTSEC-2025-0134, RUSTSEC-2026-0371, RUSTSEC-2026-0370 and RUSTSEC-2026-0372. These are maintenance warnings, not five demonstrated vulnerabilities.
- Impact: Reduced upstream maintenance/support across certificate parsing and native/transitive tooling. No runtime failure established.
- Evidence and limits: All five warnings retained in PH-C08. Current branch has no deny/audit ignore policy introduced by this task. Git-pinned shared audio, system libraries and the prebuilt engine are not comprehensively scanned by Cargo.lock matching.
- Sources: Exact IDs, titles and upstream links remain in the captured cargo-audit JSON output.
- Required investigation/correction and validation: Map enabled platform/dependency owners, separate the Tungstenite/native-certs migration that removes rustls-pemfile from upstream GTK/Tauri/zbus migrations, and document any maintainer disposition per branch. Keep warnings visible. No mass upgrade or suppression applied.

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
