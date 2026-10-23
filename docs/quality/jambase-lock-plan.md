# PH-STAB-001 — JamBase lock investigation and correction proposal

D-PH-12 subsequently authorizes this plan; see the [implementation and validation record](jambase-lock-validation.md). The D-PH-11 investigation below is retained as historical evidence.

## Authority and candidate

D-PH-11 on 2026-10-23, clean main at `14f382a`. The maintainer requested investigating the observed JamBase test failure and proposing a correction before changing code, retaining other alerts. This phase changes documentation only. Production/test source, manifests, lockfiles, source pins, feature selections and advisory policy remain unchanged. No implementation, commit, publication or live provider request is authorized or performed.

Finding **PH-008**, CONFIRMED, provisional Medium: premature end of budget ownership can leave an inherited file lock temporarily held, causing false-busy configuration/request admission. The controlled reproduction uses actual Engine/Budget APIs and fictional credentials in a disposable directory, not user configuration. The helper programs and traces are temporary/ignored diagnostic evidence, not product code or an applied correction.

## Observed failure and cause

The Lot 4 initial suite failed at `core/src/local_tests.rs:301`, removing a configured key after a successful status projection. The shared public message was “Budget JamBase illisible ou occupé. Aucune recherche envoyée.” That log did not distinguish validation, IO and lock errors. It did not demonstrate a provider outage, exhausted quota or corrupted journal.

Current source path:

- `Engine::configure_concerts` (`core/src/local.rs:371`) acquires a Budget before reading/publishing a key, intentionally refusing mutation when admission is unavailable.
- `Budget::at` (`core/src/concerts_budget.rs:58–67`) opens the private jambase-budget.lock and calls File::try_lock. The retained `_lease` is an ordinary File, without an explicit unlock guard.
- At the end of configuration/request handling, the File closes. On Unix, that does not release flock ownership while another duplicated/inherited descriptor still refers to the same open file description.
- A subprocess created concurrently can retain such a reference before exec closes it. Other tests launch processes, including the explicit cat fixture and the macOS `/sbin/mount` path in `core/src/local_mounts.rs:7`. Thus excluding only the cat test does not remove all process creation.

An owned, temporary macOS dyld interposer traces only failed flock calls on the fictional projection test's budget path. It preserves the original call arguments, return and errno. The unchanged test reproduces **operation 6 (LOCK_EX | LOCK_NB), errno 35 (EWOULDBLOCK), close-on-exec already set**. The failure is at lock acquisition, not journal parsing. Setting close-on-exec again would not remove the pre-exec inheritance window.

A separate single-threaded diagnostic links the actual unmodified phemios-core and explicitly holds an inherited descriptor in a child behind a pipe barrier. After the parent drops its Budget, configure_concerts still refuses key removal; the key remains intact. Once the child exits, removal succeeds and usage is unchanged. A separate std::fs control shows explicit File::unlock permits reacquisition while the duplicated/inherited reference still exists, whereas close alone does not. This demonstrates the proposed primitive, not an implemented Budget fix.

The exact syscall from the historical Lot 4 run was not captured. The matching source path/error and later unchanged-test syscall reproduction strongly explain that failure, while the controlled ownership defect is directly established. The budget/local source bytes did not change in Lot 4; no keepawake/zbus call participates in the standalone reproduction.

## Reproduction and diagnostic isolation

Host: macOS arm64, Rust 1.99.0, 12 reported CPUs. File-descriptor soft limit 1,048,575; no FD-exhaustion error is observed. Each original test uses its existing isolated PID/name root. All filters below are diagnostic comparisons, not proposed permanent skips or serial execution of the suite.

| Unchanged-test selection                                              | Runs                                 | Result                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| All 15 local tests, 12 threads                                        | 14, stopped after three failing runs | Projection test fails on three runs                                                                          |
| Local tests excluding explicit cat-spawn fixture                      | 13, stopped after three failing runs | Budget/projection cases still fail; mount inspection still launches processes                                |
| Projection + explicit cat-spawn test only                             | 200                                  | One projection failure                                                                                       |
| Two JamBase-only tests, no process-spawn test                         | 200                                  | No failures                                                                                                  |
| All local tests serially                                              | 100                                  | No failures                                                                                                  |
| Full local selection with final syscall tracer                        | 7, stopped at traced failure         | Projection try_lock returns EWOULDBLOCK with close-on-exec set                                               |
| Actual public Engine/Budget with inherited descriptor held by a child | One controlled scenario              | False busy after parent drop; genuine busy while owner lives; recovery after child exit; key/usage preserved |
| Independent std File close versus explicit unlock                     | Both controlled cases                | Close remains blocked with inherited reference; explicit unlock allows reacquisition                         |

These bounded samples establish reproductions, not an estimated production failure rate. No live JamBase API, real credential, subscription quota or original audio file is used. Temporary fork diagnostics perform only async-signal-safe calls in the child and reap it; that unsafe harness is not proposed for the product or permanent regression suite. Initial optional trace setup failed because the SDK lacked the convenience header; those failed-load attempts are not counted as successful tests. Only the final recorded trace is evidence.

Ignored evidence: `target/quality/PH-STAB-001/jambase-review/`: baseline fingerprints, local-stress/isolation JSON, captured failures, actual-API fork control, final traced-failure JSON/log and fresh vendor audit. Source/diagnostic hashes and dates are retained in the campaign ledger. Standalone helper source is copied there for local repeatability, not committed as project implementation.

## Proposed correction, after approval

1. **Add a deterministic failing ownership regression first.** In sibling budget tests, acquire the real guard, duplicate its File using safe std::fs::File::try_clone, then drop the original owner while keeping the duplicate open. Reacquisition must succeed. Also assert that a real live owner still blocks a second acquisition, and that closing the old duplicate after a new owner acquires cannot release that new owner's lock. This uses the same shared-open-description mechanism without scheduling sleeps, fork, unsafe code or a new dependency. Retain existing test behavior/counts and keep shared fixtures test-only.
2. **Introduce a small private RAII lease.** Wrap the File immediately after successful try_lock, before reading/parsing the journal. Its Drop explicitly calls File::unlock, then ordinary File destruction closes the handle. Store this lease in Budget. This covers normal returns, early journal/IO errors and unwinding. A Drop implementation only on Budget would miss failures before Budget construction. Never create a successful-owner guard for a refused try_lock. Keep this private: public Budget/Engine APIs and journal format remain unchanged.
3. **Preserve fail-closed behavior and observable failures.** Keep nonblocking refusal for an actual owner, private permissions, symlink/corruption/rollback admission, retained high-water accounting and reservation-before-HTTP. Failed key changes must not modify secrets or reset usage. Do not delete/recreate lock files or journals. Drop must not panic on unlock failure; retain a minimal credential/path-free diagnostic and close the handle. Add error-path/unwind coverage and validate that a failed acquisition cannot release somebody else's lease.
4. **Revalidate the existing cases unmodified and in parallel.** Run the deterministic new cases, all existing budget/configuration/privacy tests and a bounded repeat of the original local selection with default parallelism. Keep the cat/mount fixtures enabled in final acceptance. Then run the unfiltered workspace suite, frontend/tooling checks, Clippy/Rustdoc and native build, and attempt tools/check.sh with the known stable-engine prerequisite reported honestly. Report every failure, not only a later green rerun. Execute targeted Unix checks on Linux and native ownership checks on Windows/Rust 1.90 where available.
5. **Retain complete advisory and campaign visibility.** Re-run normal plus supplemental Cargo advisory assessment and required npm checks without exceptions. Keep GLib's RUSTSEC-2024-0429 local-fix/Linux-pending record explicit; PH-006's actual Linux backend acceptance and PH-007's independent transfer review remain open. No dependency update is expected for this std-only correction. Commit only if subsequently requested.

File::unlock has been stable since Rust 1.89, within the existing 1.90 project minimum. Implementation should use that API rather than introducing a platform-specific locking library. Rust 1.90/Linux/Windows execution remains a validation requirement, not an inference from documentation.

No correction has been applied. Serial execution and filtering above isolate the defect; the proposed final suite retains parallel tests. The initial full suite's later PASS does not close PH-008 now that the unchanged tests and controlled ownership scenario reproduce it.

## Primary contracts

- [Rust File::try_lock](https://doc.rust-lang.org/std/fs/struct.File.html#method.try_lock), [File::unlock](https://doc.rust-lang.org/std/fs/struct.File.html#method.unlock): duplicated/inherited handles and explicit unlock, stabilization 1.89.
- [Apple flock manual](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/flock.2.html): fork/dup references share one lock; [Linux flock manual](https://man7.org/linux/man-pages/man2/flock.2.html): release after explicit LOCK_UN or closing every reference. Linux documentation does not substitute for running the App there.
- [Apple dyld interposition contract](https://github.com/apple-oss-distributions/dyld/blob/main/include/mach-o/dyld-interposing.h), used only for the temporary original-test diagnostic.
- Existing [concert contract](../design/concerts.md), [Lot 4 validation](lot-4-validation.md), [findings](findings.md) and [campaign ledger](release-checklist.md).
