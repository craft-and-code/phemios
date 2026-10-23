# PH-STAB-001 — Lot 4 proposal: keepawake and zbus

D-PH-10 subsequently authorizes implementation/testing/checks and a final commit. The [Lot 4 validation](lot-4-validation.md) records the resulting local Linux source port, real private-bus tests, advisory visibility and pending Linux acceptance. The statements below retain the D-PH-09 planning baseline.

## Authority and diagnosis

D-PH-09, 2026-10-23. The maintainer requested possible solutions and a plan before changing these dependencies, keeping other alerts visible. This document is an investigation, not authorization to implement, publish a fork, open an upstream PR or push. Lot 3b was separately completed and committed as `8eedcbe`; its checks and limits are recorded in [its validation](lot-3b-validation.md). This proposal starts from that clean commit. No Lot 4 dependency/source/runtime modification has been made.

The locked all-target reverse tree has a single zbus owner:

```text
phemios (src-tauri)
└── keepawake 0.6.1
    └── zbus 5.19.0 (Linux)
        ├── zbus_names 4.3.5       RUSTSEC-2026-0371
        ├── zvariant 5.15.1        RUSTSEC-2026-0370
        └── zvariant_derive 5.15.1 RUSTSEC-2026-0372
```

These are three **standalone-crate maintenance notices**, not three demonstrated exploitable vulnerabilities. The crates were consolidated into zbus 6: names become zbus::names, wire encoding becomes zbus::wire, common types/derives move to zbus and its macro crate. The affected standalone crates have no patched versions; merely refreshing them cannot clear the branch.

Fresh primary-source/registry checks on 2026-10-23:

- keepawake **0.6.1** is still the latest stable release (published 2026-08-20). Its Linux manifest requires zbus ^5.3.0. Upstream master also uses this requirement and the old blocking implementation; the retrieved complete PR list contains no zbus 6 migration. This is a dated observation, not a promise about future upstream work.
- zbus **6.1.0** is published, not just a Git candidate; registry publication timestamp 2026-10-23T11:04:18Z. Its changelog labels it 2026-10-22; do not confuse changelog and publication dates. It declares Rust **1.89**, within Phémios's declared 1.90 baseline; the future complete resolved graph still needs an MSRV check and an actual 1.90 build.
- zbus 6 *_removes zbus::blocking, generated *ProxyBlocking types and the blocking-api feature*_. The upstream migration guide recommends driving the asynchronous APIs with zbus::block_on from synchronous programs. Updating the manifest alone would fail to compile keepawake.
- Its default runtime changes from async-io to zruntime, with new feature boundaries. This affects connection lifetime and progress, not only imports. No execution against zbus 6 or temporary migration implementation is claimed by this planning pass.

## Behavior to preserve

The current [display worker](../../src-tauri/src/display_awake.rs) creates/releases one OS guard on its dedicated thread, away from UI/audio callbacks. Phémios requests **display=true, idle=true, sleep=false**. It inhibits automatic idle/display sleep during confirmed playback; it must continue allowing explicit/manual system sleep. A new scope retires the old guard; renewals occur every five seconds and the lease expires after twelve seconds without renewal. Existing tests cover renewal, pause/expiry/scope replacement, stale updates, failed acquisition and retry.

keepawake's Linux source uses the session bus org.freedesktop.ScreenSaver Inhibit/UnInhibit cookie and system bus org.freedesktop.login1.Manager Inhibit("idle", ..., "block") file descriptor. Sleep inhibition exists in the library but is disabled by Phémios. No additional GNOME/portal fallback was found; this plan must not claim one or silently add a new power-management policy. Wayland/X11 desktop availability depends on the services actually exposed.

One concrete cleanup risk needs tests in the future migration: current Linux Drop calls un_inhibit(cookie).unwrap(). If the service disappears or refuses the call, that path can panic in the dedicated worker. This is static source evidence, not a reproduced Phémios crash. Acquisition can also fail after acquiring the display cookie while establishing the system-bus inhibition. A replacement must release partial resources and preserve the original failure without panicking or reporting an active lease.

The frontend's three-second acknowledgement deadline and twelve-second lease expiry do **not** currently prove that a stalled native D-Bus operation is bounded: a worker blocked inside a call cannot process expiration. The implementation must explicitly bound acquisition/release and verify behavior during loss of either bus. Do not infer that a timeout at the UI automatically cancels the native operation.

## Options considered

| Option                                                              | Assessment                                                                                                                                                                                                                         |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Published keepawake release using zbus 6                            | Preferred long-term source; none is currently published. Recheck immediately before implementation.                                                                                                                                |
| Add direct zbus 6 or run cargo update on the old branch             | Insufficient: ^5 excludes 6, and a parallel direct dependency leaves the three old notices present.                                                                                                                                |
| Force a cross-major version override                                | Not a source migration; old blocking APIs no longer exist. Reject a fake version or alias intended to trick resolution.                                                                                                            |
| Switch to another inhibition library                                | Possible, but would need a fresh license/maintenance/platform/API audit and introduces wider behavior changes. No better verified drop-in candidate is established by this investigation.                                          |
| Own Linux inhibition in Phémios, keep keepawake only on Mac/Windows | Technically possible; avoids maintaining a whole imported library but makes Phémios directly own D-Bus protocol/runtime code. Reserve for an unmaintainable upstream port rather than rewriting all platforms.                     |
| Reviewed local keepawake 0.6.1 source with a Linux-only zbus 6 port | Recommended immediate path if no upstream release appears. Preserves the existing public builder and untouched Mac/Windows backends, but requires explicit local maintenance, provenance/audit coverage and real Linux validation. |
| Wait and retain the notices                                         | Honest fallback if Linux validation or a correct port cannot be completed. Keep the findings open; do not disable inhibition or ignore advisories.                                                                                 |

## Proposed implementation, after approval

1. **Recheck upstream and freeze the baseline.** Prefer a suitable published keepawake migration if available. Otherwise import the exact published 0.6.1 archive, verify its Cargo.lock/registry checksum `0d950f8c457c023d71a2b7fa0a3550e8eb5127811895b666086ff10304911d9a`, retain MIT/license and original version/API, and record a reviewable local patch. No floating Git branch or unrelated platform/dependency refresh.
2. **Add failing Linux regressions first.** Use an isolated private D-Bus daemon and mock session/system services, never inhibit the real workstation during automated tests. Exercise the production backend through configurable test connection factories/addresses; keep new tests/fixtures outside production .rs files. Assert service/path/interface/method names, exact display/idle/sleep requests, cookie reuse/release and descriptor lifetime. Include failed/partial acquisition, missing service, denied call, disconnect/restart, delayed calls and release failure without panic. Retain existing Phémios scope/lease/frontend tests and counts.
3. **Port only the Linux backend.** Candidate zbus 6.1.0; replace blocking connections/proxies with the async Connection and generated proxies, update methods to async, and use OwnedFd from the supported root path. Preserve the synchronous keepawake builder/Drop contract via an explicitly owned/driven runtime on the existing dedicated thread. Prototype and test a single runtime lifetime for connections and cleanup rather than assuming short-lived block_on calls keep work running between renewals. The official default-rt/proxy feature combination is a candidate; select and document features after compiling the real path. No zvariant compatibility aliases or new global async runtime in the audio callback.
4. **Make acquisition/release reliable.** Give D-Bus operations explicit deadlines compatible with the acknowledgement/lease behavior. Clean up display cookies if later idle inhibition fails; close every owned FD once; release on pause/stop/completion/logout/new scope/TTL/exit. Handle UnInhibit refusal/disconnection without unwrap/panic. If Drop cannot return an error, retain a bounded observable diagnostic and ensure connection/FD cleanup; do not silently report successful release. Do not catch all panics as a substitute for sound cleanup. Prove that a failed cleanup cannot kill the worker or retire a newer lease.
5. **Resolve the real graph narrowly.** Apply the one reviewed keepawake source patch; update only its required zbus branch. Confirm all targets have no zbus 5, zbus_names, zvariant or zvariant_derive packages remaining, and that no second owner revives them. Record all required added/removed runtime packages and their MSRV/license/advisory status. Preserve Tokio 1.53.3 or newer corrected compatibility, Aède source pin, frontend locks, Mac/Windows behavior and manual sleep permission.
6. **Retain complete advisory visibility.** Add local keepawake provenance, patch hashes, license/credits and real upstream name/version to the existing source scanner. Run the real full Cargo/npm audit plus the labeled supplemental assessment of every local package. Resolve the three maintenance records only when their actual package blocks disappear. GLib RUSTSEC-2024-0429 remains explicit with its current Linux-pending disposition; new alerts fail/require review. No ignore, fake version or product feature removal.
7. **Validate and report before closure.** Run Linux backend/private-bus tests, actual App compilation, Clippy/Rustdoc, existing Rust/frontend suites, source/lock audits, Rust 1.90 and Mac/Windows builds. On real Linux desktop(s), verify inhibition during playback and release on pause/stop/completion/logout/expiry/exit using systemd-inhibit --list and a desktop exposing the supported ScreenSaver interface; check normal manual sleep and failure UI. Test X11/Wayland environments separately where available. The stable-Aède shared-crates preparation blocker remains a separate gate failure until genuinely fixed. Commit only when requested; no publication/upstream messaging is implied.

The first implementation checkpoint should be **Linux isolated-bus tests plus the reviewed keepawake source port**, followed by graph/audit and cross-platform acceptance. If no Linux runner is available, code/host checks can progress when authorized, but Linux support and PH-006 closure must remain pending.

## Primary references

- [keepawake releases/registry](https://crates.io/crates/keepawake), [published dependency metadata](https://crates.io/api/v1/crates/keepawake/0.6.1/dependencies), [current upstream manifest](https://github.com/segevfiner/keepawake-rs/blob/master/Cargo.toml), [Linux backend](https://github.com/segevfiner/keepawake-rs/blob/master/src/sys/linux.rs), [upstream PRs](https://github.com/segevfiner/keepawake-rs/pulls?q=is%3Apr).
- [zbus 6.1.0 registry metadata](https://crates.io/api/v1/crates/zbus/6.1.0), [published dependencies](https://crates.io/api/v1/crates/zbus/6.1.0/dependencies), [upstream migration guide](https://github.com/z-galaxy/zbus/blob/main/book/src/upgrading-to-6.md), [changelog](https://github.com/z-galaxy/zbus/blob/main/zbus/CHANGELOG.md).
- [zvariant maintenance notice](https://rustsec.org/advisories/RUSTSEC-2026-0370.html), [zbus_names maintenance notice](https://rustsec.org/advisories/RUSTSEC-2026-0371.html), [zvariant_derive maintenance notice](https://rustsec.org/advisories/RUSTSEC-2026-0372.html).
