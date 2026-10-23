# PH-STAB-001 — JamBase lease correction validation

## Candidate and authority

D-PH-12, 2026-10-23, base main `14f382ac4897de45d8f2938528926bae7192a592` plus the uncommitted D-PH-11 investigation records. The maintainer explicitly authorizes the [reviewed plan](jambase-lock-plan.md), tests, checks and a final commit. No push, release, dependency/pin/policy or provider-request change is included. This implementation context is not independent review.

## Scoped correction

`core/src/concerts_budget.rs` retains a small private successful-acquisition Lease. Its Drop calls std File::unlock before closing the handle, rather than depending on the last inherited/duplicated handle closing. Acquisition failure constructs no owner guard. The guard is installed before journal loading and passed by value into the private read_retained constructor, so early journal errors and unwinding release ownership too. Cleanup never panics on an unlock error and writes only a fixed diagnostic, without credentials, filesystem paths or OS error details. Public APIs, schema, nonblocking admission, quota/high-water accounting, durable pre-HTTP reservation and private-storage refusal remain unchanged. No new unsafe code or dependency.

All four added cases live in the existing sibling concerts_budget_tests.rs. Safe File::try_clone deterministically retains the shared file description; no sleeps, process forks, retries or suite serialization are added. They cover normal owner retirement with a charged attempt, unwinding, five malformed/schema/rollback journal cases and non-file journal admission. A live owner still blocks acquisition; a refused acquisition cannot release it; closing the retired duplicate cannot release a successor. Existing test cases and assertions are preserved. The focused budget implementation remains below the usual 250-line guidance.

## Before/after and verification

The first command, `cargo test -p phemios-core --locked --offline concerts::budget::tests:: -- --nocapture`, exits 101 on the unmodified implementation: both newly added normal/unwind regressions fail on reacquisition; all 11 existing budget cases pass. The expected caught panic is distinct from the subsequent failed assertion. After correction, `cargo test -p phemios-core --locked --offline concerts:: -- --nocapture` exits 0: all 25 selected concert cases pass, including the four new cases. Nothing is ignored.

The original local selection passes **200 default-parallel runs** with all 15 cases and its cat/mount process paths retained. The budget selection, now 15 cases, passes **100 default-parallel runs**. No failures, ignored cases or test changes outside the budget sibling file. These bounded stress samples are not a production failure-rate estimate. Logs are ignored local evidence in target/quality/PH-STAB-001/jambase-fix/; commands run at the repository root on macOS arm64 with Rust 1.99.0 and Node 26. Physical provider access, actual Linux/Windows and Rust 1.90 execution are separate acceptance.

## Retained alerts and limits

GLib RUSTSEC-2024-0429 must remain explicitly visible through the supplemental local-source assessment; raw cargo-audit excludes locally patched sources. PH-003/006 Linux/minimum-version/desktop acceptance and PH-007 independent transfer review remain open. Full engine preparation requires a published stable Aède containing the shared crates; a blocked gate cannot be reported as PASS. Live JamBase credentials/quota, installer packaging and cross-platform execution are not established by these fixtures. No whole-campaign closure or release approval is claimed.

## Completed host controls

- Mandatory `bash tools/check.sh`: executed, exit 1 at automatic preparation because official stable Aède v0.6.1 lacks shared audio crates. Before that boundary, format/lint/provenance, 60 Node cases, 1,334 Vitest cases in 241 files, strict App/component TypeScript, frontend/analysis builds, generated TS contracts, Storybook and bridge checks pass. Existing bundle-size/plugin-timing and Node deprecation warnings are retained, not hidden. This is BLOCKED for the complete gate, not PASS.
- Separate locked/offline `cargo test --workspace`: exit 0, **524 cases**, none ignored: 289 core, 80 native-session harness, 30 CD, 14 transfer and 111 native-host. FFmpeg/FFprobe are installed and required; native transfer cases use the existing Aède 0.6.1 / FlacCompagnon 0.9.6 sidecar. No shared-source replacement.
- Separate workspace format, all-target Clippy and Rustdoc (warnings denied), and linked native workspace build: all exit 0. CARGO_INCREMENTAL=0; no installer or launched-App acceptance is inferred.
- `node scripts/build-site.mjs --reuse-technical` and `node scripts/check-site.mjs dist-site`: both exit 0, all 26 pages/local links with regenerated technical outputs.
- Fresh `npm audit --json --audit-level=low`: exit 0, zero vulnerabilities. Fresh `npm run audit:dependencies`: exit 0, no raw registry vulnerability/notice matches, and explicit supplemental **GLib RUSTSEC-2024-0429**, backported fix with Linux validation pending. Every local inventory is verified. Database revision: 84d943a6deeb8cc6c6f632531aaf4f1c62275239; observed 2026-10-23T20:59:23.015Z. This is not whole-product/Linux clearance.
- Seven unrelated source/dependency/vendor fingerprints match the D-PH-11 baseline: workspace Cargo manifest/lock, npm manifest/lock, local engine/tests and vendor inventory remain unchanged. No ignore, waiver, lock-file deletion, journal reset, source normalization or package migration. See ignored fingerprints.json for the exact seven names/digests.

Actual Rust 1.90, Linux and Windows execution remains NOT RUN: this host has no rustup, container runtime or those native targets. Native platform flock/LockFileEx behavior and minimum-toolchain acceptance must still run there. Private lease/error paths have host regressions, not cross-platform certification. Independent campaign reviews and release authorization remain separate. PH-008 is **FIXED — TO VERIFY**; overall campaign recommendation remains **FIX AND REVALIDATE**.

The [campaign ledger](release-checklist.md#16-d-ph-12--jambase-lease-correction) retains actual commands, exits and sanitized evidence digests. No push or release is performed.
