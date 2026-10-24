# macOS ad-hoc packaging and Lucide validation

## Candidate and boundaries

Verified on 2026-10-24 on the macOS Apple Silicon host against an uncommitted candidate based on `738bc42dc6c4451252088be33507a035b69c0238` (application metadata remains 0.2.0). This is a local packaging/UI candidate, not a replacement for the published 0.2.0 installers. Aède v0.7.3 at `85a557681d1a86a851e4e1cb4f806b41adbfcd87` was selected from the official stable release and frozen for this cycle; the embedded engine reports FlacCompagnon 0.9.6.

## Executed controls

| Control                                                | Result and evidence                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bash tools/check.sh`                                  | PASS: 101 Node tests, 1,441 frontend tests in 254 files, 550 Rust executions; none ignored/skipped on this host. Formatting, lint, vendor-source integrity, builds, TypeScript, bridge, Clippy/Rustdoc and 26-page site checks pass.                                                 |
| `npm run build:native`                                 | PASS: a new release App is built, Tauri signs both executables and the whole bundle with identity `-`, and the automatic App check succeeds.                                                                                                                                         |
| `npx --no-install tauri bundle --ci --bundles app,dmg` | PASS: creates and retains the signed App and its DMG from the built candidate.                                                                                                                                                                                                       |
| `node scripts/check-macos-bundle.mjs --dmg`            | PASS: complete seal and executable/engine signatures; read-only mounted DMG copy matches the retained App. The checker detaches its mount.                                                                                                                                           |
| `codesign --verify --deep --strict --verbose=2`        | PASS on the actual candidate App: valid on disk and satisfies its designated requirement. Signature metadata reports `Signature=adhoc` and a sealed resource envelope.                                                                                                               |
| Original installed 0.2.0 App                           | The new checker rejects its missing `Contents/_CodeSignature/CodeResources`; it is inspected read-only.                                                                                                                                                                              |
| Actual candidate tamper check                          | A disposable copy first passes, then is rejected after modifying its icon resource. The original candidate remains intact.                                                                                                                                                           |
| Five native regression cases                           | Real compiler/codesign/DMG fixtures retain success, reject linker-only signatures, changed resources, missing/modified engines and a substituted signed App. These run as part of the Node suite on macOS.                                                                           |
| Lucide browser controls                                | All 98 semantic symbols render; shared 18 px dimensions, 1.6 stroke, inherited color and decorative accessibility attributes pass. An actual click changes Play to Pause and another restores Play. The existing five Icon stories remain present alongside the two added scenarios. |
| Lucide production inclusion                            | 96 selected official components back the retained 98 semantic names. Direct submodule imports avoid compiling the rest of the catalogue.                                                                                                                                             |
| `npm audit --json`                                     | PASS: zero vulnerability matches after adding locked `lucide-solid` 1.61.0; no exception/ignore is added. This does not replace the separate native/system dependency assessment.                                                                                                    |
| Release policy and workflow                            | All six existing release tests pass; Actionlint validates the workflow with its optional ShellCheck integration disabled.                                                                                                                                                            |

The first full-gate attempt was stopped during an unresponsive Storybook transform using the library barrel. The final direct imports pass the complete gate; Storybook completes in approximately 26 seconds. The first DMG-only packaging attempt signs the App correctly but removes its intermediate bundle, so the final comparison correctly fails. The final workflow explicitly requests `app,dmg` and the actual package comparison passes. Incomplete attempts are not counted as successful controls.

## Candidate artifact

The retained local DMG is `Phémios-0.2.0-local-adhoc.dmg` (copied from Tauri's `Phémios_0.2.0_aarch64.dmg`), with its SHA-256 sidecar. Its size is 14736713 bytes and its SHA-256 is:

```text
51188e47994dfe16d76799f84a5a323612ae2a6a2e60b95622d2d566283724d3
```

External local evidence retains full-gate/build logs, the original rejection, the candidate signature metadata, read-only DMG comparison, actual-copy tamper rejection, audit result and browser screenshots. No release asset was uploaded/replaced, no tag moved and no commit/push performed.

## Limits

Ad-hoc signing establishes bundle integrity, not a verified Apple developer identity or notarization. `spctl --assess --type execute` still rejects this candidate (exit 3 on this host); automatic Gatekeeper acceptance is not claimed. No quarantine flag, system protection, installed App or personal profile is modified. The candidate App is not launched or installed. Physical audio/device, provider, minimum-toolchain and Linux/Windows acceptance are not established by these checks. No PH-C09/campaign closure is implied. The reviewed GLib local-source/Linux acceptance limit remains unchanged.
