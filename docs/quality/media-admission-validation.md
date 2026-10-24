# Media admission corrections — PH-STAB-001

## Candidate and authority

The maintainer authorizes the ordered stabilization resumption, fresh-context agents, regression work, quality records and applicable gates. New findings are presented before corrections. Commit creation still requires final maintainer validation; no push, tag, workflow dispatch or publication is authorized.

Entry: clean Phémios `main` at `2709c1319a972c4b1b5722c94adab04137a30e55`, 1,463 tracked/unignored regular files. C2 adds PH-009/010/011 corrections and regression helpers; 1,304 non-document files (all inventoried paths outside `docs/`) have aggregate SHA256 `bf2faf957cc4dddf8a49d50e58c94a29769201b079473afbae62b5941b444c5d`. Method: sort relative UTF-8 paths, hash path + NUL + binary file SHA256. Inventory identity is not exhaustive review coverage.

Initial official latest-stable selection was published Aède v0.7.2, revision `168bd4a4a432aed42957c4ff230ea91d77c6c09f`; its discovery, focused retained-fix review and first genuine negative/positive media regressions remain attributed to that candidate. During the pass, GitHub published non-draft/non-prerelease **v0.7.3** at 2026-10-24T09:53:46Z. The official Phémios resolver then selected exact revision **`85a557681d1a86a851e4e1cb4f806b41adbfcd87`** for C1/C2. No in-progress sibling checkout is used. Each cycle freezes a genuinely verified release using the existing `AEDE_AUDIO_RELEASE` mechanism; a later cycle resolves stable publication again.

`node scripts/audio-source.mjs` changes only the workspace Git revision and aede-audio/aede-dsp lock version/source entries, from the entry 0.7.1 to 0.7.3. Other package resolutions, feature choices, vendor bytes/provenance and audit policy remain unchanged. `node scripts/prepare-engine.mjs` builds the embedded engine from the same clean published source, locked/offline after preparation. Bundled metadata reports Aède 0.7.3 / FlacCompagnon0.9.6 and the same audio revision. Rebuilt sidecar SHA256: `4c3cc9a0956e0588d98b5c24a9f396ff1581efa011040403db7008f24f45148f`.

## Corrections and regression contracts

- PH-009 Medium/HIGH: capture radio's exact initiating source/login before any preparation await; no early lease; fresh final captured-owner admission before play. Stop/disposal/newer starts retain ownership. Resume shares that path; the independent review also directly exercises Resume with a held resolver and original-HEAD wrong-owner control.
- PH-010 Medium/HIGH: cached named administrator/legacy external-media exemptions require exact enabled live identity, unchanged recognized role and valid capability state. Capable-user policy reads remain authenticated and owner-bound. Native CD/download/output and frontend named guards use the boundary. Genuine legacy absence does not fabricate a disabled policy; capability appearance checks the live policy. Explicit guests and public offline cache admission remain distinct.
- PH-011 Low/HIGH: retain anonymous radio's originating source without a lease or named request; remove three selection-based ownerless retirement guesses. An unrelated later named source cannot stop it. Same-source login replacement, supervision, Stop, pause and disposal still retire the appropriate lifetime.

Fresh-context Test Engineers and production correctors own disjoint files; parent executes tests. No previous assertions were changed simply to pass. All new test assertion bodies stay frozen. Rust tests/helpers remain declared sibling test-only files; no production inline test or orphaned new suite.

### Before/after evidence

On unchanged pre-fix production plus test additions, four original suites run 51 cases: **33 FAIL, 18 PASS controls**, genuine behavior assertions with no compile/setup failure. After PH-009/010, the identical suites PASS 51. These targeted runs use the initially selected 0.7.2 source; the final full C2 gate separately reruns their cases on published 0.7.3. Counts: radio22, frontend named17, native core6, native CD6. The native CD cases also execute under the native-host suite in the full workspace; do not equate unique authored cases with total test executions.

Commands, from repository root:

```sh
node node_modules/vitest/vitest.mjs run src/library/radio-start-owner.test.ts
node node_modules/vitest/vitest.mjs run src/library/named-media-admission.test.ts
CARGO_INCREMENTAL=0 cargo test -p phemios-core --lib network::tests::media_admission:: --locked --offline -- --nocapture
CARGO_INCREMENTAL=0 cargo test -p phemios-core --test native_sessions cd_accounts::tests::admin_admission:: --locked --offline -- --nocapture
```

| Suite             | Negative log SHA256                                                | Positive log SHA256                                                |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| PH009 radio       | `00824c448e7c0febb7e38efd5fb793444874e75ac32e5f638a06e478b3a4d308` | `351b2ed7dc16fdc782775352a48564b8a020d91594f8dcbaa1dc90f903ed7560` |
| PH010 frontend    | `d484ce37845b0f294711cf58db9a72067f19f22b82d9def1ec4795af456e44ff` | `6569f7c49bb5208c9733b682e51c47bde191a60f07478543a3e975b27b600090` |
| PH010 native core | `dab1453bce642893c4c9d606cfd399847d6113bdbcef7a2b1d13677a432beffb` | `07f13d75e446090959cb2053b9b1ba10e2016e91b2441d5e7bc5d280beb89549` |
| PH010 native CD   | `c185f21eb5cd2631ba5a5c4aed598a9adceedc072f4a20fa5650e40f40f10ca8` | `7f9b60a5b76e66a4fc0da457c6afb4f231b1e7906175e748eaba475b99ac5c23` |

The initial named-media setup attempt overlapped completion of test-only fixture setup and is excluded from frozen evidence. The final repeat above ran on unchanged production with stable setup; excluded attempts remain retained, not silently converted to passes.

PH-011: `node node_modules/vitest/vitest.mjs run src/library/guest-radio-isolation.test.ts`, published 0.7.3 C1b before correction: **FAIL 2/PASS 6**, exit 1; C2 after correction: **PASS 8**, exit 0. Both symmetric unrelated-source failures reproduce idle instead of playing. Controls retain named own/unrelated refusal, guest zero IO, supervised login retirement and Stop during deferred resolution. Test/fixture bytes are identical before/after. Negative SHA256 `81f4d9e9dfe5c344f07259f465bcd69a80016f7e47ac4195a690cff261c4b25b`; positive `374b1d88b39df01ec8ecb58407435b982d94bbe3c47560f1ae2d4c2c8d68481a`.

### Legitimate old fixture adaptations and declaration checks

The first adjacent/full runs expose old protocol fixtures, preserved as failures in the ledger. They are not suppressed:

- Native CD's old same-account replacement fixture closed its mock server after login. A dedicated helper now retains the first exact authority for the initial allowed permission; both old success/refusal assertions remain and a new assertion forbids any successor HTTP after replacement.
- Two original-export fixtures add a stable ID and one exact live auth preflight before the unchanged export byte stream. Three native streamed-transfer cases serve bounded login → auth → auth → export (transfer and original-export each check authority), verifying the captured bearer; every original source/byte/root-reappearance/conversion/publication assertion remains.
- Existing named/admin provider request overrides now return exact captured-account + enabled identity for the new GET auth route, instead of an unrelated generic catalogue page. Existing artwork/logout/held-annotation/policy assertions and parameter matrices remain. Disposal compares initial exact-owner reads with the unchanged list after disposal/45s, rather than banning legitimate pre-disposal admission.
- Two new TS fixture helpers initially fail declaration emission because inferred returns refer to private Library/Vitest internals. Only public type/interface annotations are added. Parent and reviewer independently transpile frozen before/current helpers with esbuild; each emitted JavaScript is byte-identical. No test exclusion or runtime/assertion change. `npm run docs:ts` then PASS 457 declaration modules before the PH-011 addition; final C2 gate regenerates the complete current set.

All original/new authored test counts are retained; added fixture data strengthens authenticated routes rather than bypassing production admission.

## Current automated validation

Host macOS 27.0.1 arm64, Xcode 26.6, default Rust/Cargo 1.99, Node 26.10/npm 11.19.1; installed FFmpeg/FFprobe9.0.2. Required `PHEMIOS_REQUIRE_FFMPEG=1`, `CARGO_INCREMENTAL=0`; native transfer checks use the coherent0.7.3 sidecar. Logs/JSON and hash inventories are supplemental temporary evidence under `/tmp/phemios-stab-resume-ngstwxh3`; substantive commands, counts, identities and limits are retained here so their loss does not turn an empty link into verification.

`bash tools/check.sh` on C2 **PASS**, exit 0, 90.23s, 2026-10-24T10:27:23Z–10:28:53Z. The genuine `AEDE_AUDIO_RELEASE` selection above is frozen in its environment; `CARGO_BUILD_JOBS=4`. It executes formatting/lint/vendor provenance; 60 Node + **1,439 Vitest cases in 253 files**; strict frontend build, standalone analysis, TS documentation, component types/Storybook, bridge coherence; official same-source engine preparation; Rust format; **550 Rust executions** (120 native host,30 CD,297 core,89 native-session harness,14 transfer), none failed/ignored; workspace all-target Clippy/Rustdoc with warnings denied, 26-page bilingual site/local links and native workspace build. Linux-only GLib/keepawake/macro checks are not applicable to this Mac-host run and remain mandatory in the separate Linux matrix.

Workspace test/Clippy/Rustdoc/build commands in the gate use `--locked`; engine preparation and separate minimum-toolchain commands explicitly use `--locked --offline`. No stronger invocation profile is inferred.

Successful gate log SHA256 `8e92ed6dc35f9ebbc427ea4ed7df478bced40897ebdba7c5a593dd22ce7f6aa3`. Nonfatal Vite chunk-size and Node module.register deprecation warnings remain visible; no threshold or exception is relaxed.

The first full attempt fails five old frontend cases (FAIL 5/PASS 1426); after evidenced fixture adaptation their three suites PASS 23. The second attempt PASS 60Node/PASS 1431Vitest, then fails TS declarations; annotation-only correction is verified before C2. Initial Rust 1.90 execution fails three old streamed-transfer protocol fixtures; final rerun below passes. None of these earlier failed attempts is described as a successful full gate.

### Genuine Rust 1.90 host execution

Official checksum-verified minimal Rust 1.90.0 is installed into isolated temporary roots without shell-profile/default-toolchain changes. Actual versions: rustc1.90.0 `(1159e78c4 2025-09-14)`, cargo1.90.0 `(840b83a10 2025-07-30)`. `RUSTC`/`RUSTDOC` and executable Cargo point directly to that toolchain, with its bin first on PATH and an isolated target directory; this is not the default1.99 pretending to verify minimum support.

`cargo test --workspace --locked --offline --no-run` PASS; then `cargo test --workspace --locked --offline` with required FFmpeg and exact0.7.3 sidecar **PASS 550**, zero ignored, 31.57s. Log SHA256 `750832bc364087989ececc93d8670b1d715f0b340254ef8543170b0d6df7d263`. This execution is C1a's native inputs; all 441 core/crates/native/vendor/manifest/lock inputs are byte-identical on C2, whose later change is frontend-only. Its applicability is recorded, not silently relabeled a second execution. Root instructions retain their earlier pending-status annotation; this later Mac execution supplies precise host evidence without changing the minimum requirement or clearing other platforms.

### Fresh advisory assessment

- `cargo audit --json --file Cargo.lock`: PASS exit 0, zero matches/notices, current DB1,352 advisories, commit `21d909e4c8bd4e14c7aea58bf980c881a0053ab1`; no ignores. Log SHA256 `4e7075ce04b5c0e60edc6bcaa7560fcbb78d2537eea4fa313fa14a2072cd039c`.
- `npm audit --json --audit-level=low`: PASS exit 0, zero vulnerabilities; log `38a76f6a733e83cdd8ac8c395294119a829620692b2b038c6210a3178283884f`.
- `npm run audit:dependencies`: PASS exit 0 for provenance/source assessment while explicitly retaining **RUSTSEC-2024-0429 GLib 0.18.5**, backport present but Linux validation pending; log `978d1c640c6471273878138d08735768d9cb4b1bf5905468ca45509123bc9c1e`. Raw audit0 is not local-source/Linux/product clearance. Git source, prebuilt engine contents and native/system dependencies are not comprehensively covered by the client lockfile audit.

## Review and remaining acceptance

R-PH-FIX-01 supports retained PH-007/008 within stated limits. R-PH-GEN-01 is nonclean because it confirms Medium PH-009; it cannot advance the consecutive clean pair. Supplemental client/native discovery confirms/deduplicates PH-009/010, not independent general credit. R-PH-MEDIA-01 independently supports PH-009/010 correction roots and discovers Low PH-011; it is focused and predates the final C2 delta. R-PH-GEN-02 and R-PH-GEN-03 supply the two consecutive qualifying independent general reviews on conserved final C2. Both directly select paths in all six partitions, with distinct primary focuses, and find no new confirmed Critical/High/Medium or Low. GEN-02 records 101 selections and four actual-module current diagnostic scenarios; GEN-03 records 123 selected paths and nine current scenarios (six media, three private queues), all PASS. Their original-HEAD controls, selected depth and omissions are explicit in the [register](findings.md). Both before/after 1,304-path maps equal the C2 software identity above. Focused reviews and the release evidence validator do not count toward the general pair. Any substantive later software change requires affected-path review/revalidation before applying the pair.

`npm run build:native` **PASS** exit 0, 173.20s, produces the 34.29MiB `target/release/bundle/macos/Phémios.app` on C2. Log SHA256 `ffe49df4d5925ad576ddfda5da58d64f4c10eae565d5b968afe05d1dba4d17e5`. Its plist identifies Phémios0.1.0 / `fr.craftandcode.phemios`, executable arm64; bundled `Contents/MacOS/phemios-aede` hashes exactly to the prepared0.7.3 sidecar above. Main executable SHA256 `1688340bc45d6bc3c10a657e2cdc972ff27e26f849441c00d38e121661d89fec`. This is artifact construction, not installed-App, signing/notarization or runtime UI acceptance. The workflow-equivalent `npx --no-install tauri build --ci --bundles dmg -- --locked` also **PASS**, exit 0,120.61s. Its14.25MiB artifact is `target/release/bundle/dmg/Phémios_0.1.0_aarch64.dmg`, SHA256 `a1811abffdd88817c93efdb29e0b579a8a19ee1319b196ffc9236020367032b4`; build log `567bbef2b8f0380188be84c802e362afd054dc307fba623c8de19ef3e680800a`. The DMG build intentionally cleans its staging `.app`; the image remains as the current artifact. `hdiutil verify`, temporary `attach -readonly -nobrowse`, internal plist/main/engine byte checks and `detach` all PASS, without execution or installation. Both the packaged main executable and engine match the prior App inventory. Inspection log `16428907ce8441f9131ce00a8527eeb091df0c3784022038a846855c3840519c`, exit 0,4.27s. No signing/notarization, mounted personal volume or user profile is used. No App launch/installation, sound, optical drive, real receiver/HQPlayer/device, MTP/iPod, live provider or personal-library acceptance is inferred. Mac Rust 1.90 is not Linux/Windows native execution; missing mandatory software/platform/installer controls block closure. This checkout has no Git remote and no Docker/Podman/Lima runner available. No remote, workflow dispatch, VM or publication is invented to clear missing evidence. PH-003/006 Linux validation and GEN1-C2's qualified queued-prepare robustness hypothesis remain explicit in the register.

Campaign closure and release authorization remain separate maintainer decisions. This record grants neither and creates no commit.

## Additional real embedded-engine integration

A new disposable native probe links the actual corrected `cd_accounts.rs` and current Cargo-identified `phemios_core` artifact, using the same published 0.7.3 sidecar on loopback and fictional temporary accounts. Initial current-admin CD and unrestricted-download admission pass. Another administrator then demotes that account and enables supervision. Its old bearer is refused by GET session; the retained recurring CD permission and unrestricted-download helper now both refuse, while a fresh supervised login also refuses CD. No device is opened and no episode bytes are downloaded/published. The source/linked-artifact/binary hashes and exact Cargo/rustc/child commands are retained separately; this is parent integration evidence, not a new permanent test or reviewer execution.

`python3 <evidence>/live-admission-073/run.py` PASS exit 0, 7.11s; log SHA256 `27aefd76c323b34381d3636a486fa36c4bb1191a363a50af08d1857ec998fd7e`. It leaves original pre-fix audit artifacts untouched, verifies current compiled inputs and terminates its temporary protocol1 server cleanly. This confirms the live0.7.3 account-view shape and stale-authority refusal at the software boundary; it does not audit an external deployment or the entire engine.

## Final evidence disposition

R-PH-VAL-01 independently validates the frozen review pair and actual parent evidence, without performing another code audit or gate. Parent separately verifies every frozen report artifact before recording. GEN-03 report SHA256 `762fbf14a2494b3fa7ae385cd0135fe559c9787bdb810a379d2ba463d5cdb295`; validator report `d190c00f02d36dff71e4cd0b25214edfcfca11de88fd66d2dbb87fd660dc545c`. Full review identities/manifests, independence, direct coverage, own executions and omitted acceptance are retained in the register rather than relying only on temporary links.

PH-009/010/011 are **VERIFIED within the documented C2 software correction scope**: 59 unique added regression cases (51 + 8), genuine red/green evidence, current full Mac gate, applicable real minimum-toolchain execution, affected-path independent reviews and the clean general pair. Actual installed-App/native-platform/device acceptance remains separately unexecuted. This status does not clear PH-C09. PH-003/006/007/008 retain their explicitly required finding-specific acceptance.

**CONTINUE.** PH-C10 passes; PH-C09 remains BLOCKED. Next steps require actual Linux and Windows runners for mandatory native/minimum-version/App/installer controls, plus finding-specific GLib/GTK/macro/keepawake/lock/root acceptance. Record exact candidate, OS/toolchain/prerequisites, commands, exits/counts/log hashes and artifact identities. Installed-App runtime and supplementary physical/provider/deployment acceptance remain separate. The maintainer must review uncovered coverage/residual hypotheses and authorize any future closure and release independently. No environment, exception, waiver, remote or publication is invented to complete the matrix. Final parent recording-only checks are recorded in the checklist after the validator freeze; they do not constitute another general review.
