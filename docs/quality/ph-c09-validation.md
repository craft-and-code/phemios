# PH-STAB-001 — PH-C09 native validation kit

## Status, authority and candidate

D-PH-18 is **preparation only**. The maintainer approved the Linux/Windows validation plan and requested scripts, tests and documentation in fresh contexts, without commit or push. This document is a procedure and an empty acceptance ledger, not a native result, a general audit or release approval. **PH-C09 remains BLOCKED; the campaign verdict remains CONTINUE.** PH-003/006/007/008 remain **FIXED — TO VERIFY**. Physical/provider/deployment limits remain qualified, and cannot excuse missing mandatory software evidence.

Freeze these identities for this validation cycle:

| Identity                                      | Required value                                                      |
| --------------------------------------------- | ------------------------------------------------------------------- |
| Protected Phémios product baseline            | `main` at `a08821d8a0b28662035c3988e6c1dae2485380fc`                |
| Published Aède release                        | `0.7.3`                                                             |
| Exact shared-audio and embedded-engine source | `85a557681d1a86a851e4e1cb4f806b41adbfcd87`                          |
| Linux host                                    | Ubuntu 22.04 x86_64, `x86_64-unknown-linux-gnu`                     |
| Windows host                                  | Windows 11 x64, `x86_64-pc-windows-msvc`, native Windows            |
| Toolchains                                    | Current `stable` and genuine `1.90.0`, each with Rustfmt and Clippy |
| Package profile                               | Stable toolchain; Linux AppImage/DEB/RPM and Windows MSI/NSIS       |

The protected product inputs preserve the reviewed C2 product. The old C2 aggregate fingerprint `bf2faf957cc4dddf8a49d50e58c94a29769201b079473afbae62b5941b444c5d` over 1,304 files is historical: new validation scripts/tests change the aggregate of all non-document files. Record product identity and validation-kit identity separately. R-PH-GEN-02/03 reviewed the C2 product, not the new kit; a focused tooling review and portable kit tests supply separate evidence. No third general product review is automatically required merely to finish PH-C09. Any substantive product change requires explicit applicability assessment, affected-path review and revalidation before relying on the existing pair.

The runner checks the baseline tree and working product against the frozen product, allowing only the exact kit overlay listed below. `AEDE_AUDIO_RELEASE` intentionally reuses the published selection previously verified and accepted in D-PH-16/R-PH-VAL-01: [Aède v0.7.3](https://github.com/craft-and-code/aede/releases/tag/v0.7.3), release ID `422641968`, non-draft/non-prerelease, published `2026-10-24T09:53:46Z`, official response SHA256 `9c4cc712cb6df9ca64c2ad8e6882f97b5a86ea204417f6523a081642a5e019e0`. This kit does not perform a fresh release-metadata/latest-stable query in each native run: the supplied frozen payload bypasses that resolver lookup. Official preparation checks the exact source revision, clean cached source and shared-crate availability; final source-selection/engine metadata are checked and hashed. The same source must supply the shared crates and embedded engine. No sibling checkout, old cached sidecar or 0.7.1 fallback is acceptable. If the baseline, upstream release/source or kit changes, start a newly identified cycle and review the applicability of earlier evidence. Never merge results from incompatible candidates.

## Kit and CLI contract

The overlay contains exactly twelve paths:

```text
scripts/ph-c09.mjs
scripts/ph-c09-policy.mjs
scripts/ph-c09-candidate.mjs
scripts/ph-c09-evidence.mjs
tests/ph-c09.test.mjs
tests/ph-c09-runner.test.mjs
tests/ph-c09-fixtures.mjs
docs/quality/ph-c09-validation.md
docs/quality/README.md
docs/quality/audit-scope.md
docs/quality/findings.md
docs/quality/release-checklist.md
```

Root instructions, production source/tests, manifests/locks, vendor bytes/provenance and dependency/advisory policy stay protected. The kit uses Node built-ins, without a new product dependency. The CLI is:

```text
node scripts/ph-c09.mjs --help
node scripts/ph-c09.mjs plan --platform linux|windows --stage prepare|gate|audit|package --toolchain stable|1.90.0 --evidence OUTSIDE_REPO_DIR
node scripts/ph-c09.mjs run --platform linux|windows --stage prepare|gate|audit|package --toolchain stable|1.90.0 --evidence OUTSIDE_REPO_DIR
```

`plan` is read-only and can describe another host. `run` refuses a mismatched native OS, Node architecture, Rust host triple or actual Rust/Cargo/Rustdoc version before executing the stage. WSL and a cross-compiled binary do not establish native Windows acceptance. The evidence directory must be outside the checkout, must not exist yet, and must have an existing parent; symlink aliases must not place it inside the repository. Use a unique directory for every stage/toolchain/attempt and retain failed attempts.

| Stage     | Actual work                                                                                                                        | Boundary                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `prepare` | `npm ci`; official `node scripts/audio-source.mjs`; `cargo fetch --locked`                                                         | Dependency/source preparation, requiring network; no native PASS follows from preparation alone                              |
| `gate`    | Mandatory FFmpeg/FFprobe probes, then the complete authoritative `bash tools/check.sh`                                             | Runs under the selected real toolchain with `PHEMIOS_REQUIRE_FFMPEG=1` and `CARGO_INCREMENTAL=0`; no reduced workflow subset |
| `audit`   | Raw `npm audit --json --audit-level=low`, raw `cargo audit --json --file Cargo.lock`, then `node scripts/vendor-audit.mjs`         | Retains raw and supplemental local-source reports; GLib warning remains explicit                                             |
| `package` | Stable only: official Tauri build with platform bundle list, then `node scripts/release.mjs package Linux-x86_64` or `Windows-x64` | Requires empty `target/release/bundle` and `dist-release`; builds/hashes artifacts, does not install or launch them          |

The minimum profile has an isolated `target/ph-c09-minimum-{platform}` directory; stable uses the normal target directory. Profile records retain actual tool versions, command arguments/working directory/environment, timestamps, raw exits, stdout/stderr logs and SHA-256, before/after candidate checks, sidecar metadata and binary/artifact inventory. `manifest.json` is the entry point; stdout/stderr logs use the fixed command IDs, such as `authoritative-gate.stdout.log` and `authoritative-gate.stderr.log`. The supplemental audit report is copied from `target/quality/vendor-audit/report.json` to evidence. Keep stable/minimum binary hashes separate and save them before another profile replaces the sidecar. These are platform-specific artifacts, so their hashes need not equal the historical Mac engine binary.

Use a trusted native developer environment with the normal Cargo configuration; this kit is not a hermetic build or hostile-host sandbox. Inherited compiler/doc wrappers, Rust flags, Cargo target test runners, release/profile overrides and conflicting source/toolchain/target settings are refused case-insensitively rather than silently substituted. Inspect an identified conflicting key and remove it only from the dedicated validation shell before retrying; do not rewrite product configuration. Ordinary native SDK/PATH and network credential settings remain available to child tools, but only the fixed validation environment whitelist is recorded.

Each requested interruption fails the active command and leaves later commands NOT RUN. The checkout lock is retained on both platforms: POSIX signal dispatch or Windows `taskkill /T /F` exit alone does not prove every descendant has stopped. Preserve the interrupted evidence and inspect the recorded owner/process tree before deliberately recovering a stale lock. Never blindly delete the lock or begin another run while an owned descendant may still use the checkout. Hard termination may leave an incomplete manifest or lock; neither is successful evidence.

The runner does not install system packages, toolchains or applications, launch the App, restart services/buses, modify acceptance statuses or authorize a release. A successful runner exit establishes only the commands and inventory in that manifest. Independently evaluate the evidence and complete applicable manual cases before changing PH-C09.

## Native host preparation

Prepare disposable machines and fictional libraries. Allocate enough disk for two Rust profiles, the official engine source/build, frontend dependencies, logs and all installers. Use a real desktop session for runtime acceptance; a headless build or Xvfb alone cannot validate desktop/logind behavior. Record machine/VM image, OS edition/version, architecture, desktop, X11/Wayland, systemd and service versions, native tools and any virtualization limitations. Keep personal libraries, retained production stores and real provider credentials out of fixtures.

Install prerequisites as a deliberate host setup step; the runner never performs these installations. Recheck the [release workflow](../../.github/workflows/release.yml) and [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) when provisioning. Record exact installed versions rather than assuming an old image remains configured.

### Linux

Use Ubuntu 22.04 x86_64 GNU as the build base, matching the release workflow and avoiding an unintended newer glibc baseline. The workflow dependencies are:

```text
libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev
librsvg2-dev patchelf libasound2-dev libdbus-1-dev libssl-dev
build-essential autoconf automake libtool squashfs-tools
```

Also provide `pkg-config`, `libglib2.0-dev`, `dbus`, `dbus-x11`, FFmpeg and FFprobe (`ffmpeg`), `rpm` and `libfuse2` for the required tests and package paths. Package availability/installation is host preparation, not automatic runner behavior. The real acceptance desktop must expose the claimed `org.freedesktop.ScreenSaver` service and systemd logind; record unsupported/missing services explicitly. Provision a separate Fedora-compatible disposable VM for actual RPM installation/runtime, because building or inspecting an RPM on Ubuntu is not RPM installation acceptance. Validate each X11/Wayland environment that is claimed supported; no added portal or desktop-specific fallback is implied.

### Windows

Use native Windows 11 x64 with Microsoft Visual Studio Build Tools, **Desktop development with C++**, the x64 MSVC toolchain and Windows SDK; Git and Git Bash; WebView2 Runtime; and FFmpeg/FFprobe accessible from the shell used by Node and Cargo. MSI construction needs the applicable VBScript Windows feature available; verify it on the chosen image rather than interpreting a missing build prerequisite as a product failure. Record installer/tool versions and any setup failure. Use the x64 developer environment and launch Git Bash with that environment inherited when needed, so `bash tools/check.sh` and the Windows MSVC linker operate together. Do not use WSL for this profile.

### Shared tooling

Use Node 24 x64 on both native hosts, matching the desktop release jobs. The workflow's source-resolution job currently uses Node 22; this does not change the native kit recommendation. Provide Git, npm and rustup, then install both `stable` and `1.90.0` with `rustfmt` and `clippy`, plus cargo-audit 0.22.2. Example host-setup commands, to run deliberately before the kit:

```sh
rustup toolchain install stable --component rustfmt --component clippy
rustup toolchain install 1.90.0 --component rustfmt --component clippy
cargo +stable install cargo-audit --version 0.22.2 --locked
rustup run stable rustc -vV
rustup run 1.90.0 rustc -vV
node --version
npm --version
ffmpeg -version
ffprobe -version
```

The executable/version probes must prove that the minimum profile actually uses 1.90.0. Merely reading `rust-version`, setting a label, installing a cross target or running default stable is insufficient. Do not change the product's minimum, delete a lockfile, upgrade packages or expand advisory exceptions to make a profile pass. Stop and record a real incompatibility if one appears.

## Export the frozen product and uncommitted kit from Mac

This section describes the delivery procedure; creating its bundle/archive is a separate preparation action and supplies no native acceptance. Adapt the generic absolute paths to the machines used. A bundle of `main` alone omits the uncommitted kit. Preserve the product as a Git bundle and the exact twelve-file overlay as a separate tar archive; no staging, temporary index or commit is needed.

On the Mac source machine, use Bash from the repository root. `EXPORT` must be an external new delivery directory. Before export, inspect the tree and verify that all differences are confined to the twelve listed kit paths; do not include unrelated work.

```sh
cd /path/to/phemios
EXPORT=/path/to/export/PH-STAB-001-C09
mkdir -p "$EXPORT"
PRODUCT=a08821d8a0b28662035c3988e6c1dae2485380fc
test "$(git rev-parse HEAD)" = "$PRODUCT"
test "$(git rev-parse main)" = "$PRODUCT"
git status --short
cat > "$EXPORT/ph-c09-kit-files.txt" <<'EOF'
scripts/ph-c09.mjs
scripts/ph-c09-policy.mjs
scripts/ph-c09-candidate.mjs
scripts/ph-c09-evidence.mjs
tests/ph-c09.test.mjs
tests/ph-c09-runner.test.mjs
tests/ph-c09-fixtures.mjs
docs/quality/ph-c09-validation.md
docs/quality/README.md
docs/quality/audit-scope.md
docs/quality/findings.md
docs/quality/release-checklist.md
EOF
KIT_FILES=()
while IFS= read -r kit_path; do KIT_FILES+=("$kit_path"); done < "$EXPORT/ph-c09-kit-files.txt"
shasum -a 256 "${KIT_FILES[@]}" > "$EXPORT/ph-c09-kit.sha256"
git bundle create "$EXPORT/phemios-main.bundle" main
git bundle verify "$EXPORT/phemios-main.bundle"
tar -czf "$EXPORT/ph-c09-kit.tar.gz" "${KIT_FILES[@]}"
(
  cd "$EXPORT"
  shasum -a 256 phemios-main.bundle ph-c09-kit.tar.gz ph-c09-kit-files.txt ph-c09-kit.sha256 > delivery.sha256
)
```

The array/while form works with Mac's bundled Bash; `mapfile` is not required. Retain the export commands, commit identity, dirty-state inventory and delivery hashes together. Transfer the bundle, archive, path list and checksums through the chosen trusted channel. No remote or workflow dispatch is needed or assumed.

On Linux or Windows Git Bash, set generic reception and disposable checkout paths. Verify the received delivery hashes against the trusted Mac record first. Delivery checksums are relative to the reception directory; kit checksums are relative to the checkout after extraction.

```sh
IMPORT=/path/to/received/PH-STAB-001-C09
WORK=/path/to/disposable/phemios-c09
PRODUCT=a08821d8a0b28662035c3988e6c1dae2485380fc
(
  cd "$IMPORT"
  sha256sum -c delivery.sha256
)
git clone --config core.autocrlf=false "$IMPORT/phemios-main.bundle" "$WORK"
cd "$WORK"
git bundle verify "$IMPORT/phemios-main.bundle"
git checkout --detach "$PRODUCT"
test "$(git rev-parse HEAD)" = "$PRODUCT"
tar -tzf "$IMPORT/ph-c09-kit.tar.gz"
tar -xzf "$IMPORT/ph-c09-kit.tar.gz"
sha256sum -c "$IMPORT/ph-c09-kit.sha256"
git status --short
node scripts/ph-c09.mjs --help
```

Inspect the archive list against `ph-c09-kit-files.txt` before extraction. Extract only the reviewed twelve paths into this disposable clone. Keep LF product bytes by disabling automatic checkout conversion as shown. A different checkout path is expected; a different product byte, unknown extra file or missing kit path is not. `run` performs the protected-product/allowed-overlay checks before and after commands. Keep the per-file kit hashes with native evidence so a later kit edit does not silently reuse an earlier result.

## Execute and retain native evidence

Use one checkout per native OS and unique stage directories under an existing external evidence parent. The examples below use shell variables only to reduce repetition. On Windows, run them in Git Bash with native Node/Rust/MSVC available. Run sequentially; do not reuse evidence directories, overwrite failed attempts or run competing native builds in the same checkout.

```sh
PLATFORM=linux
EVIDENCE=/path/outside/repository/PH-STAB-001-C09
mkdir -p "$EVIDENCE"
node scripts/ph-c09.mjs plan --platform "$PLATFORM" --stage gate --toolchain stable --evidence "$EVIDENCE/stable-gate-01"
node scripts/ph-c09.mjs run --platform "$PLATFORM" --stage prepare --toolchain stable --evidence "$EVIDENCE/stable-prepare-01"
node scripts/ph-c09.mjs run --platform "$PLATFORM" --stage gate --toolchain stable --evidence "$EVIDENCE/stable-gate-01"
node scripts/ph-c09.mjs run --platform "$PLATFORM" --stage audit --toolchain stable --evidence "$EVIDENCE/stable-audit-01"
node scripts/ph-c09.mjs run --platform "$PLATFORM" --stage package --toolchain stable --evidence "$EVIDENCE/stable-package-01"
node scripts/ph-c09.mjs run --platform "$PLATFORM" --stage prepare --toolchain 1.90.0 --evidence "$EVIDENCE/minimum-prepare-01"
node scripts/ph-c09.mjs run --platform "$PLATFORM" --stage gate --toolchain 1.90.0 --evidence "$EVIDENCE/minimum-gate-01"
node scripts/ph-c09.mjs run --platform "$PLATFORM" --stage audit --toolchain 1.90.0 --evidence "$EVIDENCE/minimum-audit-01"
```

For Windows set `PLATFORM=windows` and an appropriate external evidence path. Run `package` only under stable; requesting it with 1.90.0 is an input refusal, not minimum acceptance. Retain each command's true exit; stop on failure and investigate before the next dependent step. If automating the sequence in Bash, use `set -euo pipefail`. The runner captures child exits directly. Do not use `command | tee ...` without preserving the actual command exit, or convert a failed tool into success through a wrapper.

Before packaging, retain any earlier installer outputs outside the checkout and use a clean package output state; the runner refuses pre-existing bundle/release outputs rather than selecting a stale package. Do not delete failed evidence to obtain a green state. The [release workflow](../../.github/workflows/release.yml) currently runs only a subset of the full gate and no genuine minimum-toolchain matrix; dispatch alone cannot supply these missing checks. The kit does not dispatch, tag, publish or sign.

For every profile, inspect the manifest, raw logs, actual counts/ignored cases, source selection, protected-product checks, versions and exit status. Retain warnings and initial failures. Do not copy the historical Mac count of 550 to another platform: conditional Unix/Linux/Windows coverage differs. Native compilation, tests, linked executable, package construction, read-only package inspection and installed runtime are separate results.

### Finding-specific software evidence

The full gate is authoritative. The following explains the evidence to extract from it and any additional scoped diagnostic command; targeted green replays cannot replace the gate. For direct Cargo diagnostics use the same real toolchain, isolated target profile, required FFmpeg and exact freshly prepared sidecar as the recorded gate.

| Finding               | Required native evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PH-003                | Linux: all eight `crates/phemios-glib-regression/src/variant_tests.rs` cases in both debug and optimized release on stable and 1.90.0; actual GTK/WebKit/native build. `tools/check.sh` runs workspace debug plus the separate release crate. Record locked reverse trees for `glib@0.18.5`, `glib-macros@0.18.5`, `gtk3-macros@0.18.2` and `keepawake@0.6.1`, proving exact local source owners; retain vendor integrity/provenance and supplemental GLib advisory. Windows GLib/Linux-only cases are `NOT APPLICABLE`, with the platform reason, not PASS.                                                                                                                                      |
| PH-006 macro port     | Linux: `node scripts/macro-regression.mjs --fetch` under both toolchains, retaining upstream cases, the real GTK composite-template contract in `tests/macro-harness/gtk_linux_tests.rs`, and all thirteen useful compiler refusals without macro panic. Host token parsing alone is insufficient.                                                                                                                                                                                                                                                                                                                                                                                                |
| PH-006 keepawake port | Linux: `node scripts/keepawake-regression.mjs --fetch` under both toolchains, importing `vendor/keepawake/src/sys/linux.rs`. All fourteen private-bus cases must run. Its first test command excludes `stalled_authentication_is_bounded_and_rolls_back_display` only because the subsequent separate command executes that exact case with a fresh non-answering private socket. Preserve both logs; the temporary `--skip` is not an omitted case. These private buses never supply real desktop acceptance.                                                                                                                                                                                    |
| PH-007                | Both OS/toolchains: full `phemios-transfer` and native `phemios --lib transfer` suites, including actual loopback HTTPS export/original and MP3 copies through the exact embedded engine, unchanged original/other-file witnesses, unavailable/returning root and newly configured root refusal, and destination replacement. Inspect `crates/phemios-transfer/src/{guard_tests,mounted_tests}.rs` and `src-tauri/src/transfer_job_tests.rs`; retain each actual platform's count and conditional limits.                                                                                                                                                                                         |
| PH-008                | Both OS/toolchains: the four cloned-handle/normal/unwind/journal cases in `core/src/concerts_budget_tests.rs`: `dropping_a_budget_releases_its_lock_even_with_a_duplicated_handle`, `unwinding_a_budget_releases_its_lock_with_a_duplicated_handle`, `rejected_journals_release_the_lease_before_a_budget_can_be_constructed`, and `journal_admission_errors_release_the_lease_with_a_duplicated_handle`; plus unfiltered concert/local coverage. Preserve real busy-owner exclusion, charged usage/quota, corrupt/schema/rollback journal refusal, successor ownership and retained bytes. No live JamBase key is needed. Never reset a journal or weaken a true-busy assertion to make it pass. |

Example Linux reverse-tree diagnostics for each selected toolchain, retaining stdout/stderr and the real exit separately:

```sh
cargo +stable tree --target x86_64-unknown-linux-gnu --locked --offline -i glib@0.18.5
cargo +stable tree --target x86_64-unknown-linux-gnu --locked --offline -i glib-macros@0.18.5
cargo +stable tree --target x86_64-unknown-linux-gnu --locked --offline -i gtk3-macros@0.18.2
cargo +stable tree --target x86_64-unknown-linux-gnu --locked --offline -i keepawake@0.6.1
```

Repeat with `+1.90.0` for the minimum profile. Preserve actual paths and selected local source identity, rather than just package names/versions. The raw Cargo audit skips local package registry matching; zero raw matches alone cannot clear the upstream-affected GLib 0.18.5 / **RUSTSEC-2024-0429** record. The supplemental source assessment must keep that warning, the applied two-line backport, provenance and Linux acceptance disposition explicit. Unknown advisories, graph changes or altered vendor bytes require triage; no new allowlist, omitted development graph, fake patched version or exception is authorized.

## Package inspection, installation and runtime acceptance

Create one acceptance record per OS, package kind, desktop/service variant and relevant case. All new cases below start **NOT RUN**. Capture actual artifact SHA-256, package inventory, packaged main/engine hash and version metadata before installation; prove the engine matches the source selected in the same profile. Inspecting a package is not installing it; installing is not exercising its native runtime. Do not accept a successful message alone as OS behavior evidence.

| Case                  | Platform / prerequisite                                                                 | Steps and expected result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Initial status |
| --------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| C09-PKG-LINUX         | Ubuntu desktop; freshly built AppImage and DEB                                          | Inspect package contents/dependencies/main/engine identities. Install DEB in the disposable host and launch from installed location; launch the actual AppImage through its normal supported runtime. Exercise startup, WebView/IPC, native menu/dialog, temporary local engine login/logout and clean shutdown. Record each artifact separately.                                                                                                                                                               | NOT RUN        |
| C09-PKG-RPM           | Fedora-compatible disposable desktop VM; same frozen-source RPM                         | Inspect, install with the native package manager and execute installed runtime smoke/IPC/menu/login/shutdown. Record Fedora image and dependencies. Ubuntu RPM construction/inspection cannot replace this.                                                                                                                                                                                                                                                                                                     | NOT RUN        |
| C09-PKG-WINDOWS       | Windows 11 x64; actual MSI and NSIS; WebView2                                           | Inspect each package, install each in a clean/disposable snapshot, run the installed App and bundled engine, exercise IPC/menu/dialog/login/logout/shutdown, and record installation/uninstallation behavior. No WSL result substitutes.                                                                                                                                                                                                                                                                        | NOT RUN        |
| C09-PKG-MAC           | Historical C2 DMG/App identities in [current validation](media-admission-validation.md) | Mac App/DMG construction and read-only image verification already PASS in that historical record. Installation/launch and applicable installed-App runtime acceptance remain required and NOT RUN; verify candidate applicability and exact artifact identity before using them.                                                                                                                                                                                                                                | NOT RUN        |
| C09-AWAKE-LINUX       | Supported ScreenSaver/logind desktop, disposable audio, X11 or Wayland identified       | Observe `systemd-inhibit --list` and actual desktop inhibition before/during playback and across renewal. Pause, Stop, natural end, logout, scope replacement, twelve-second TTL expiry and App exit must release the owned request; explicit/manual sleep must remain possible (`sleep=false`). Record elapsed/OS evidence and each transition.                                                                                                                                                                | NOT RUN        |
| C09-AWAKE-LINUX-FAULT | Disposable VM snapshot; controlled ScreenSaver/logind faults                            | Test missing/refused service, delayed/refused release and real bus/service restart; verify bounded refusal, visible diagnostics, no crash/unowned inhibition and later recovery. Only perform service manipulation in the disposable VM. Cover each claimed supported X11/Wayland/service combination; unsupported services stay explicit.                                                                                                                                                                      | NOT RUN        |
| C09-AWAKE-WINDOWS     | Native Windows backend, disposable audio                                                | Record `powercfg /requests` before/during/after playback and every release transition above; verify actual display/idle request lifetime and explicit/manual sleep behavior. `src-tauri/examples/display_awake_probe.rs` inspects OS assertions only on macOS: its message on Windows is not Windows acceptance.                                                                                                                                                                                                | NOT RUN        |
| C09-TRANSFER-NATIVE   | Both native OS; temporary source/library/destination and exact engine                   | Exercise original and MP3 transfer, cancellation/logout retirement, absent/returning/new local roots and destination replacement with opt-in replacement. Compare original audio/tags and unrelated destination witnesses byte-for-byte; refusal must precede writes into protected roots. Use only disposable inputs.                                                                                                                                                                                          | NOT RUN        |
| C09-TRANSFER-REMOUNT  | Both OS; disposable mounted volume/virtual volume                                       | Prepare a preview, unmount/remount or replace the destination/root, then try the old grant. It must retire/refuse changed identity/availability; rediscovery/new preview remains explicit. Record OS mount identity and preserved source/destination witnesses. Physical device durability remains separate.                                                                                                                                                                                                    | NOT RUN        |
| C09-TRANSFER-NTFS     | Windows NTFS, disposable directories/junction target                                    | Test an ancestor junction aliasing the protected root and a junction retargeted after preview, plus replaced folder identity. Refuse overlap/stale grants without altering protected witnesses. Unix `#[cfg(unix)]` symlink tests in `guard_tests.rs`/`mounted_tests.rs` do not cover NTFS junctions. Record the exact filesystem/privileges and limits.                                                                                                                                                        | NOT RUN        |
| C09-MEDIA-OWNER       | Installed App on both OS; disposable local/remote fixture authorities/accounts/media    | Start radio with one captured source/login while changing selection/replacing login; retire pending stale intent. Named administrator/legacy exemptions must be freshly revalidated after role/revocation; anonymous radio retains its actual origin and survives an unrelated named-source failure. Exercise pause/Stop/logout, supervised refusal, IPC errors and recovery using controlled fixtures and permitted media URLs without bypassing native media URL admission. No real provider key is required. | NOT RUN        |
| C09-LOCK-NATIVE       | Both native OS/toolchains; fixture-only budget/journals                                 | Review the four actual regressions and concert/local results against native locking. True concurrent owners remain busy; retired duplicate handles cannot keep ownership or unlock a successor; charged usage and rejected/corrupt journals remain retained. Fixture success does not establish live provider deployment.                                                                                                                                                                                       | NOT RUN        |

Use this record for each concrete execution. Copy it to the external evidence directory, replace every placeholder with actual observations, and never pre-fill PASS:

```text
Case ID: C09-...
OS / architecture / desktop / service variant:
Product commit: a08821d8a0b28662035c3988e6c1dae2485380fc
Kit per-file manifest / SHA-256:
Aède release / exact revision: 0.7.3 / 85a557681d1a86a851e4e1cb4f806b41adbfcd87
Toolchain / profile / binary SHA-256:
Artifact path / kind / SHA-256 / packaged engine SHA-256:
Prerequisites and disposable fixture identities:
Steps actually performed:
Expected behavior:
Observed behavior:
Status: NOT RUN
Proof paths / logs / raw exits / screenshots / hashes / timestamps:
Limits / missing evidence / follow-up owner:
```

Use canonical statuses from [README](README.md): `PASS`, `FAIL`, `BLOCKED`, `NOT RUN` or `NOT APPLICABLE` with a reason. Absence of a desktop or service is not a successful runtime check. Separate supplementary physical audio/DAC/gapless/optical/MTP/iPod/HQPlayer/receiver, live-provider policy/quota and production deployment acceptance; retain their unexecuted limits without relabeling mandatory Linux/Windows/minimum/installer work as optional hardware.

## Consolidation and decision

A fresh evidence validator must inspect actual manifests/logs, product/kit identity, official source eligibility/coherence, profile-specific binary/artifact hashes, real command exits/counts/warnings and every applicable manual record. Cross-check PH-003/006/007/008 against their [GLib](lot-3a-validation.md), [macro](lot-3b-validation.md), [keepawake](lot-4-validation.md), [transfer](remediation-plan.md) and [JamBase](jambase-lock-validation.md) records. Diagnose any missing/refused command, test or package explicitly; do not infer a pass from a plan, fixture or preceding Mac result.

Update the [checklist](release-checklist.md) and [finding dispositions](findings.md) only after evaluating this evidence. Preparation and portable kit tests provide no native/general review credit. Keep PH-C09 BLOCKED and the campaign CONTINUE until all applicable mandatory software/platform/installer and installed-runtime evidence is independently accepted. PH-C10's existing GEN02/03 pair remains qualified on the protected reviewed product; new tooling needs its own review, and a later substantive product delta needs affected review/revalidation. Maintainer campaign closure and release decisions remain separate; this kit grants neither and performs no commit, push, tag, dispatch or publication.
