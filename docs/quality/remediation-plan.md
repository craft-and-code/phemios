# PH-STAB-001 — Dependency remediation and transfer follow-up

## Authority and candidate

On 2026-10-23 the maintainer requested a remediation **plan** and verification of PH-007, with no hidden warnings. This follow-up authorizes read-only dependency/source investigation, disposable reproductions and quality records. That planning pass changed no production code/tests/dependencies. D-PH-03 subsequently changes only the authorized Lot 0 source/tests/documentation; manifests, lockfiles, dependency policies and native-source pins remain unchanged. No commit/publication. Candidate remains `397912b95f79d54a3eb23e64dfe589df7e3c03e7`.

Lot 0 was committed as cc1f9fa. Lot 1 was committed as f4cedb3 after D-PH-04. The maintainer subsequently authorized implementing, checking and committing Lot 2; Lots 3–4 remain proposed and unexecuted. Recheck registry/advisory metadata when implementing; do not turn these version targets into a blanket update. No `cargo audit --ignore`, deny allowlist/exception, npm `audit=false`, `--omit=dev` clearance, `npm audit fix --force`, fake patched version or dependency removal that silently disables a feature.

## PH-007 verification — confirmed conditional overwrite

The original hypothesis is now a **confirmed High data-integrity defect under a specific after-preview condition**, with HIGH confidence in the reproduced component boundary. The mere presence of an unrelated unavailable remote path is not classified as a defect.

1. Capture an existing selected destination directory. A watched root beneath it is unavailable when `Mounted::outside` runs; canonicalization fails and the guard accepts it.
2. Before copying, that watched root becomes visible, containing both a selected original and a different existing audio file at the proposed destination path. The captured destination directory/inode has not changed.
3. A repeated `outside` check would now refuse overlap, but native `Preview` does not retain roots and the job callback only reconfirms the destination identity and account/cancellation.
4. Copy the staged source using the current unmodified `transfer_job::copy` helper and the real embedded Aède executable. Its isolated catalogue knows the staging root, not the original watched-root set.

| Verification                                          | Replacement disabled            | Replacement enabled             |
| ----------------------------------------------------- | ------------------------------- | ------------------------------- |
| Unavailable root accepted at preview boundary         | Yes                             | Yes                             |
| Same captured destination identity after root returns | Yes                             | Yes                             |
| Overlap refused if outside() is explicitly repeated   | Yes                             | Yes                             |
| Copy with verification enabled                        | Refuses differing existing file | Succeeds                        |
| Other audio file inside watched root                  | Preserved byte-for-byte         | Replaced by staged source bytes |
| Selected original and staged bytes                    | Preserved                       | Preserved                       |

All source/destination files are temporary WAV fixtures. This proves loss of another library file is possible with explicit replacement; it does not claim default-mode overwrite. No real library, user credentials, physical drive or live provider used. Directory restoration is a controlled stand-in for availability/mount changes, not a physical-remount acceptance test.

The diagnostic uses the actual compiled `phemios-transfer::Mounted` policy, an exact text extraction of the unchanged native `copy` function and the actual CLI. The surrounding download/staging is supplied as a fixture; the Tauri UI, full asynchronous job and real Aède export-plan/original endpoints are not exercised end to end. Static tracing establishes where these same functions are used in `transfer_prepare` and `execute`.

Reproduction: `python3 docs/quality/reproductions/ph-007.py`, after `cargo build -p phemios-transfer --locked --offline` if its current rlib is absent. The script is intentionally Apple Silicon/current-sidecar specific and fails rather than claiming another platform was tested. It never invokes engine preparation or updates dependencies. Logs/source/metadata: ignored `target/quality/PH-STAB-001/PH-007/`. This is historical evidence for the unsafe low-level boundary: it intentionally omits the retained DestinationGuard added by Lot 0 and is not an after-fix job test. The authoritative permanent regression is now `cargo test -p phemios --locked --offline a_watched_root_returning_during_download_cannot_be_overwritten`, with PHEMIOS_TRANSFER_ENGINE set to the existing tested sidecar. Its actual old-code failure and corrected pass are retained in the checklist.

Evidence: reproduction exit `0`, Aède `0.6.1` / FlacCompagnon `0.9.6`, engine SHA-256 `c802f4719222f61a13bf49222f204f1941f600d229e066756fed8e881ef0d933`; extracted helper SHA-256 `4a234a0ad34acf053c48c6ff535008474ed51d37a6ceba92cd695f09fc6bcceb`; diagnostic source SHA-256 `a5ae57bb25fd6d0b92b94d70c7813332610b8e10dce38becd5299855e6871a80`; sanitized log SHA-256 `1053cefa7a22a5b6d990e74bbe20e6cd6a45caa13470cf6746f11af6153cbab0`. Engine preparation/source coherence with the next release is not implied by testing the existing binary.

## Proposed implementation sequence

### Lot 0 — Protect watched roots across the complete transfer lifetime (PH-007)

**Implemented and automatically revalidated in D-PH-03; independent review pending.** `DestinationGuard` separates authoritative local roots from retained remote hints; `transfer_roots::Protection` includes current local configuration even for Server-only jobs. Preview, start, post-download and child-operation admission retain/recheck the guard. Existing nonreplacement, conversion and real HTTPS cases pass; no atomic OS confinement or physical remount acceptance claimed. The paragraphs below retain the accepted design and acceptance criteria.

First add a behavioral regression reproducing the unavailable-root/returning-root case and the opt-in overwrite, keeping Rust tests in sibling `*_tests.rs` files. Retain positive disjoint-folder, present overlap in both directions, conversion, replacement-disabled and changed-mount cases.

Design the guard around source-qualified library roots and retained destination identity. Distinguish local paths from foreign server path strings; refusing every unresolvable remote path would break legitimate remote transfers. Preserve the relevant protected-root state in the preview, conservatively refuse an ambiguous **local** overlap, and revalidate before starting and before handing each staged file to publication. Include roots of a local library that must be protected even when selected tracks come only from Server. A root becoming available/redirected cannot silently upgrade an old preview into permission to overwrite its contents; require a new preview/error.

The embedded copy catalogue contains only staging. Do not assume its ordinary source guard can enforce original-library ownership; preserve that authority in the client/engine contract. A preflight recheck alone is not a claim of race-proof confinement against arbitrary concurrent ancestor replacement. If stronger atomic protection is required, design descriptor-relative publication/engine protected roots explicitly. Do not promise hardware identity from a path string.

Acceptance: the reproduced replacement case refuses before modifying the retained audio, default nonreplacement still preserves it, known disjoint remote transfers work, source/session changes retire jobs, and the existing native real-engine copy/conversion tests pass. Add a controlled transition test through the full job boundary; physical remount acceptance stays separate.

### Lot 1 — Small security updates (PH-001, PH-002, PH-004, PH-005)

**Implemented and revalidated in D-PH-04; committed as f4cedb3 after the required full-gate attempt.** The exact approved versions resolve and all corresponding advisory matches disappear from fresh full lockfile audits. GLib and all five maintenance notices remain visible. The table/design below retains the accepted before/after targets; see the checklist for actual exits and hashes.

| Component            | Current → proposed  | Scope / check                                                                                                                                                                                                                                                             |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rustls-webpki        | 0.103.15 → 0.103.16 | Narrow Cargo lock resolution; existing rustls 0.23.46 path. Preserve wrong-pin and correct-pin HTTPS/WSS refusal/admission.                                                                                                                                               |
| webpki-roots         | 1.0.9 → 1.0.10      | Narrow Cargo lock resolution for ureq; check the actual resulting root graph and refreshed RustSec report.                                                                                                                                                                |
| Tokio                | 1.53.2 → 1.53.3     | Narrow Cargo lock resolution; native Tauri/reqwest users. Recheck AsyncFd callers and native session/network/cancellation behavior.                                                                                                                                       |
| DOMPurify            | 3.4.16 → 3.4.17     | Existing Milkdown components range is `^3.2.5`; update compatible transitive npm resolution, with no extra direct dependency or override. Preserve inert Markdown images/links and editor regressions.                                                                    |
| Storybook/addon-docs | 10.6.1 → 10.6.3     | Update both explicit dev pins and compatible Storybook builder/react-dom-shim resolutions coherently. Solid adapter 10.7.2 peers accept Storybook 10 and Vite 8; inspect npm ls for duplicates/invalid peers. Test explorer policy, static component build and docs site. |

Treat each root change as a small reviewable diff. Use targeted Cargo updates with `--precise`, never a whole-workspace refresh; inspect any forced transitive changes. For npm, change only the accepted direct pins/transitive resolutions and inspect the complete lock diff rather than running a forced audit fix.

The production Vite bundle inventory (same `vite.config.ts`, `build.write=false`) includes **zero DOMPurify or @milkdown/components module entries**. Text mentioning DOMPurify in generated dependency credits is not executed sanitizer code. This narrows current desktop exposure; the installed dependency and upstream Critical alert remain visible and should still be updated. No claim about every dev/docs configuration or future import graph.

Upstream Storybook guidance distinguishes vulnerable development servers from static builds. Avoid the affected component dev server while waiting for its accepted patch; current static build success does not resolve the alert.

Acceptance: fresh npm and Cargo audits show the exact targeted matches removed without new untriaged alerts; existing Node/Vitest, Rust library/harness tests, TLS tests, native check, formatting/lints, App/analysis builds, component types/static docs and site checks pass. Preserve all unrelated warnings. Run native/MSRV/platform acceptance appropriate to an actual release after coherent engine preparation; no pin change as a side effect of these updates.

### Lot 2 — Remove the rustls-pemfile branch through Tungstenite (PH-006)

**Implemented and revalidated in D-PH-05 on base f4cedb327568a9bf477ccc8d891f973d5c335145.** Tungstenite 0.30.0 / rustls-native-certs 0.8.5 removes rustls-pemfile from the full graph. Native-root trust, exact owned-server trust, a 4 KiB read buffer, frame/message caps and TCP deadlines are retained. Three new real-socket regressions and extended wrong-pin WSS assertions pass. All prior test names remain; no audit exceptions. See the current ledger for full checks and platform/engine limits. The following paragraphs retain the accepted design rather than a new request for authorization.

Actual branch: `phemios-core → tungstenite 0.24.0 → rustls-native-certs 0.7.3 → rustls-pemfile 2.2.0`. Phémios does not directly depend on or call rustls-pemfile; replacing authored PEM calls would not remove this branch.

Preferred candidate: update the already approved Tungstenite dependency to **0.30.0**, retaining native root trust. Its manifest uses rustls-native-certs 0.8 and declares Rust 1.85, below the project baseline 1.90. Verify the resolved native-certs graph actually drops rustls-pemfile and does not retain another branch. Do not swap native roots for bundled roots merely to remove a warning; that changes user-certificate trust semantics.

This requires a separate source/test lot: Message Text/Binary use Utf8Bytes/Bytes rather than String/Vec, WebSocketConfig is non-exhaustive and gains a default 128 KiB read buffer, and error variants differ. Audit every production/fixture WebSocket use, adapt constructors explicitly, and preserve prior bounded-memory/frame/timeout behavior (choose the read buffer deliberately rather than accepting a silent increase). Test real local HTTP/WSS, pin refusal, malformed/bounded PCM, epochs, seeking, crossfade, cancellation and source replacement. Run the Rust 1.90/native matrix; manifest MSRV is not execution proof. Do not update by changing only the version number.

### Lot 3 — GTK3/GLib and proc-macro-error (PH-003 / PH-006)

D-PH-07 implements the subsequently authorized **Lot 3a only**: reviewed local GLib pointer backport, eight public-API tests, provenance checks and visible supplemental advisory assessment. [Validation and outstanding Linux work](lot-3a-validation.md). Lot 3b macro changes remain proposed. The earlier D-PH-06 planning authority below is historical.

D-PH-06 has now checked current releases and upstream fixes: see the [detailed Lot 3 proposal](lot-3-plan.md). Recommended order is a minimal GLib soundness backport, then the larger upstream-derived Syn diagnostic port at both macro owners. GTK 0.19 exists but the current Tauri/WebKitGTK owners reject that generation. proc-macro-error2 is archived. Local-source patches also require an explicit advisory inventory because cargo-audit skips them. This is a proposal only; no dependency change or commit is authorized by that planning request. The prior outline below remains historical context.

Actual Linux branch includes `Tauri 2.12.1 / wry 0.57.0 / gtk 0.18.2 → glib 0.18.5`; proc-macro-error 1.0.4 is pulled by **both** glib-macros 0.18.5 and gtk3-macros 0.18.2. Updating only one macro owner cannot eliminate its warning.

The checked GLib source has the affected `VariantStrIter::impl_get` output-pointer code. Upstream's fixed range starts at GLib 0.20, which is not a drop-in version for this GTK3 graph. Do not force a registry resolution or change only the package version to claim a fix.

First evaluate a compatible upstream GTK3/native-stack release carrying the correction. If unavailable, propose a narrowly scoped, provenance-pinned GLib 0.18 backport of the upstream fix, with a Linux optimized iterator regression, alongside a separately reviewed macro-dependency migration. Prefer upstream coordination; introducing a maintained fork/vendor source requires an explicit reviewed source decision. No message is sent upstream by this plan.

A registry backport under a version still matched by RustSec may fix the code **while cargo-audit still reports the warning**. D-PH-06 additionally confirms that a path/Git backport falls outside the installed scanner’s default registry coverage; its advisory must be retained in an explicit supplemental inventory rather than assumed to remain in raw scanner output. Keep that warning and its backport evidence visible until upstream advisory/source metadata can truthfully recognize the correction. Do not add an ignore, fabricate a 0.20 version or present a clean audit. If no compatible maintained solution exists, record this branch as unresolved rather than pretend all alerts are removable today.

Acceptance: actual Linux native graph, optimized affected-iterator cases, native App/UI integration, source provenance/license review and fresh full audit. macOS success provides no GTK3 validation. No silent Linux feature removal or GTK4 rewrite in a patch update.

### Lot 4 — keepawake's Linux D-Bus migration (PH-006)

Actual branch: `keepawake 0.6.1 → zbus 5.19.0 → zvariant 5.15.1 / zbus_names 4.3.5 / zvariant_derive 5.15.1`. The three notices describe standalone crates folded into zbus 6. keepawake **0.6.1 remains the current registry stable release** at this lookup, so a simple released patch update is not established.

Prefer a keepawake upstream release migrating its Linux backend to zbus 6. If none exists when implementing, review a small upstreamable/pinned fork rather than adding a parallel zbus dependency to Phémios; a second direct zbus 6 would leave keepawake's old branch intact. Preserve Windows/macOS behavior and existing Linux display/system inhibition semantics; do not remove keepawake or disable Linux inhibition just to silence audit.

Acceptance: verify all three obsolete standalone crates disappear from the enabled resolved graph, validate the resulting minimum Rust version, and exercise Linux inhibit acquisition/release on Stop/logout/completion plus missing desktop/D-Bus error handling. Cross-platform checks remain mandatory; no live desktop inhibition test has been performed in this follow-up.

## Evidence, gates and outcome

The locked target trees and current registry/source metadata were inspected on 2026-10-23. PH-C08 remains **FAIL**. Fresh D-PH-03 audits retain the same two Rust vulnerabilities, two unsoundness/five maintenance warnings and two npm Critical packages; no dependency fix or disposition applied. The reproduction is an isolated diagnostic, not an increase to the unit-test count or an independent review. Current campaign verdict remains **FIX AND REVALIDATE**.

Implementation status/order: Lot 0 implemented, regressions/checks passed, independent review pending. Lot 1 targeted patches are implemented and revalidated; next proposed work is the separate Tungstenite, GTK/native-stack and D-Bus migrations. Keep the original audit output and compare all warning classes after each accepted lot. No clean-audit claim until the actual relevant tools and platform gates support it.

## Primary references

- [rustls-webpki distrust fix](https://rustsec.org/advisories/RUSTSEC-2026-0382.html), [webpki-roots distrust fix](https://rustsec.org/advisories/RUSTSEC-2026-0381.html), [Tokio I/O-safety fix](https://github.com/tokio-rs/tokio/pull/8587).
- [DOMPurify advisory and fixed version](https://github.com/advisories/GHSA-cg2g-xh64-v4q7), [Storybook advisory and dev/static distinction](https://github.com/advisories/GHSA-f2ph-cmg5-wxc8). Exact npm metadata: [Storybook 10.6.3](https://registry.npmjs.org/storybook/10.6.3), [addon-docs 10.6.3](https://registry.npmjs.org/@storybook/addon-docs/10.6.3), [Solid adapter peers](https://registry.npmjs.org/storybook-solidjs-vite/10.7.2), [DOMPurify 3.4.17](https://registry.npmjs.org/dompurify/3.4.17).
- [Tungstenite 0.30 manifest](https://github.com/snapview/tungstenite-rs/blob/v0.30.0/Cargo.toml), [migration changelog](https://github.com/snapview/tungstenite-rs/blob/v0.30.0/CHANGELOG.md), [rustls-pemfile maintenance notice](https://rustsec.org/advisories/RUSTSEC-2025-0134.html).
- [GLib advisory](https://rustsec.org/advisories/RUSTSEC-2024-0429.html), [upstream pointer correction](https://github.com/gtk-rs/gtk-rs-core/pull/1343), [proc-macro-error maintenance notice](https://rustsec.org/advisories/RUSTSEC-2024-0370.html).
- [zvariant consolidation notice](https://rustsec.org/advisories/RUSTSEC-2026-0370.html), [keepawake registry status](https://crates.io/api/v1/crates/keepawake), [keepawake upstream](https://github.com/segevfiner/keepawake-rs).

## D-PH-04 result before Lot 2

Lot 1 was authorized and implemented on base `cc1f9fa91092f93790b7b7f505fe8dbed29902aa` (Lot 0 commit `cc1f9fa`). Resolved versions: rustls-webpki 0.103.16, webpki-roots 1.0.10, Tokio 1.53.3, DOMPurify 3.4.17 and Storybook/addon-docs/builder-vite/react-dom-shim 10.6.3. No new direct runtime dependency, override, suppression, broad upgrade or source-pin change. React/react-dom remain 19.3.0; other package versions and Cargo dependency edges retain their prior valid choices. Only the three approved Cargo versions/checksums and five approved npm package versions change. The dependency graph validates with locked/offline Cargo metadata and a clean npm ci --ignore-scripts; npm ls reports no invalid peers.

Fresh npm audit: exit 0, **0 vulnerabilities**. Fresh cargo-audit: exit 0, **0 vulnerability matches**, but **six warnings remain visible**: GLib 0.18.5 unsoundness RUSTSEC-2024-0429; proc-macro-error 1.0.4, rustls-pemfile 2.2.0, zbus_names 4.3.5, zvariant 5.15.1 and zvariant_derive 5.15.1 maintenance notices. PH-003/006 and later migration lots remain open. No clean whole-product security claim: Git source, prebuilt embedded engine and system libraries are not cleared by these lockfile audits.

Verification on macOS arm64 / Rust 1.99 / Node 26: 517 Rust executions, no ignored cases; 1,334 Vitest and 46 Node tests. Full workspace Clippy all-targets/Rustdoc with warnings denied and native build pass; frontend format/lint/build, analysis build, bridge, TS contracts, component types/static build and 26-page site/local link checks pass. Existing correct/wrong-certificate HTTPS/WSS and live loopback original/MP3 transfer tests pass. No new authored runtime code or tests required for these package patches; the audit before/after is the advisory-resolution regression, not a demonstrated hostile-certificate or browser exploit.

All Cargo checks use --locked --offline after an explicit locked fetch. PHEMIOS_REQUIRE_FFMPEG=1, CARGO_INCREMENTAL=0, RUSTDOCFLAGS=-D warnings; PHEMIOS_TRANSFER_ENGINE points to the existing Aède 0.6.1 / FlacCompagnon 0.9.6 binary. No engine preparation/source replacement. The full tools/check.sh was attempted before the Lot 0 commit and stopped on the published v0.6.1 missing shared crates, with no manifest/lock changes; it is not falsely reported as a successful full gate for Lot 1. Rust 1.90, Linux/Windows, installers, real-device and independent reviews remain unexecuted.

## D-PH-05 current result

Lot 1 is committed as f4cedb3. Lot 2 replaces the Tungstenite 0.24/native-certs 0.7 branch with 0.30.0/0.8.5; rustls-pemfile and its notice are absent from the current full lock graph. Five warnings remain visible: GLib unsoundness and four maintenance notices. No ignore/policy/feature suppression or shared-audio pin change. 520 Rust executions (all prior 517 plus three socket regressions), 1,334 Vitest and 46 Node cases pass, along with locked native checks/builds and frontend tooling. The full gate remains blocked by the published stable engine missing shared crates; minimum/platform/physical/independent acceptance remains pending. Lots 3/4 stay proposed. See the current checklist ledger for exact exits, hashes and scope.
