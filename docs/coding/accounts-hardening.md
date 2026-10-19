# Account lifecycle hardening

## Scope

This review follows Phémios account forms and captured source/session tickets, native login publication and invalidation, remote logout, local engine stop, role-dependent private document writes and account-owned Podcasts/Encyclopedia/Radio state. Aède review follows password verification and bounded admission, stable owners, last-administrator retention, account patch publication, session expiry/revocation, parental locks, protected persistence and native/Subsonic personal-data authorization.

Account deletion is not implemented by the current Aède contract. Explicit disabling preserves personal data and revokes access; this is a documented feature boundary rather than a deletion defect. The OS operator remains trusted independently of HTTP roles.

## Demonstrated correction

Native remote logout invalidated its local owner first, but an error returned by audio teardown skipped the subsequent server DELETE. Within teardown, a native-output error also skipped HQPlayer cleanup. The neighboring local stop path skipped owned-engine shutdown after the same kind of failure. This is one fail-fast cleanup defect group: independent release steps were chained with early returns.

The shared framework-independent `session_cleanup::complete` attempts both steps even when the first fails and retains either or both diagnostics. Remote logout and local stop use it for the independent outputs and final source release, after native session invalidation. Routing locks are confined to audio cleanup and released before the network operation or engine stop. Source ownership still prevents stopping the other source's audio. Remote revocation is attempted, not guaranteed during network failure; errors remain explicit and no retry secretly adopts a new owner.

A failing fault-injection test first reproduces skipped credential revocation with the former sequence. Three cases now verify independent release, combined errors and native/external/source ordering. No dependency, credential persistence, account migration or change to server authorization is introduced.

## Verification and limits

Phémios passes all 257 core library tests at the first corrected checkpoint, then all three cleanup cases after adding the final nested-output case; total available core cases are now 258. All 52 selected frontend cases across ten suites pass, including source tickets, connection monitoring, account drafts, parental editing and private saved data. App TypeScript, lint, all-target core Clippy, Rustfmt and formatting/diff checks pass. The changed Tauri glue is inspected and Rustfmt-checked; no native App compilation or interactive account acceptance is performed.

Aède passes all 13 account-domain cases, all 340 server cases and six selected core account/storage/history cases, with all-target account/server Clippy. The restricted server run failed to bind test sockets (Operation not permitted); the authorized local-fixture rerun passes. No live installation account or personal store is changed. No further demonstrated Aède production defect is established in the inspected paths. Its account design page is corrected to describe named-administrator HTTPS access consistently with routing, server documentation and the passing HTTPS role test.

Earlier DSP fixes remain pending and are separate from this account review. No App rebuild, commit or publication belongs to this pass. Software tests do not establish physical audio shutdown or acceptance on other operating systems.

## Rejected login and owned-engine release follow-up

Two further defects are reproduced. First, successful remote authentication can allocate a bearer token before native publication is refused because logout advanced the generation or another native session already exists. The prior caller returned that publication error without revoking the unused remote token. `publish_remote_login` now admits the native publication or attempts release of exactly the rejected Client, without clearing/replacing a successor. Remote authentication, publication and any rejected-token DELETE run on the blocking worker; the native owner lock is released before remote cleanup. Revocation failure remains visible alongside the publication error. Accepted connections retain their credentials. Local startup retains its separate owned-engine policy.

The actual framework-independent native sessions module and its sibling tests are now included by `core/tests/native_sessions.rs`, allowing their compilation/execution without Tauri or an App build. This reuses nine existing cases rather than copying their assertions. Two added cases first reproduce missing rejected-token cleanup, then confirm cancellation/busy-account refusal, successor preservation, accepted-token retention and explicit cleanup failure. Release is fault-injected; this does not claim end-to-end execution of the Tauri command or a live server token deletion.

Second, `Engine::stop` returned on an unreadable configuration or failed save before dropping its live child lease. The outer cleanup correction could call it but could not make it release its own process. Stop now attempts to persist disabled startup, unconditionally releases the process lease/identity, and returns the persistence outcome. Corrupt bytes are preserved; a failed persistence still means automatic startup could remain enabled on the next launch. A Unix child-process fixture first reproduces the retained lease with malformed JSON and afterwards verifies release plus the preserved error/file. No real Aède process or user configuration is touched.

All 259 core library cases, 11 native-session harness cases, all-target core Clippy, Rustfmt and formatting/diff checks pass. All 17 selected Aède account/API/authentication cases pass with authorized fixture sockets. No additional Aède production defect is established in the inspected privilege and revocation paths. No frontend code changes or new frontend test run belong to this follow-up. The native session policy is compiled in the standalone harness; the Tauri command wiring is inspected and Rustfmt-checked, without an App rebuild, interactive acceptance or commit.

## Managed principal name admission

The next neighboring review establishes one comparison defect group with two reproduced effects. The native local-source request guard used a case-sensitive prefix for the managed `phemios-local` login. The network allowlist admitted `PATCH /api/admin/v1/accounts/PHEMIOS-LOCAL`, while the guard missed it and Aède canonicalizes login names without case. Conversely, unrelated valid logins such as `phemios-local-child` were blocked by the prefix. This is a bypass of Phémios's managed-principal guard for an already administrative local caller, not a user-to-administrator privilege escalation in Aède.

The extracted framework-independent guard now compares the complete account-name path segment with ASCII case-insensitivity. The Tauri bridge invokes it only for the local source; remote administration retains its server policy. The owned password-change endpoint remains protected. Two regressions first fail with the prior rule and cover accepted network paths for PATCH, session revocation and parental updates, mixed/uppercase names, unrelated prefix names and allowed GET inspection. Percent-encoded account segments remain refused by the existing network path allowlist.

The review also follows rejected remote-login cleanup, session generations, local engine release and server authorization/rechecks. No additional demonstrated defect is established in those inspected lifecycle paths. All 261 core cases and 11 actual native-session harness cases pass, with all-target core Clippy, Rustfmt and formatting/diff checks. All 17 selected Aède account/authentication cases pass unchanged. No frontend change or frontend test rerun is introduced. Native command wiring is inspected and Rustfmt-checked; no Tauri App rebuild, real account mutation or commit is performed.

## Source-aware account controls

A neighboring UI defect is reproduced: SettingsAccounts protected every account named `phemios-local` regardless of source, unlike the native guard which intentionally applies only to the owned local engine. A legitimate administrator could therefore not rename, reset, enable/disable, change roles or revoke sessions for a remote namesake through these controls. This was an interface restriction, not a server authorization bypass.

The four presentation guards now share `managedLocalAccount`, which requires the local source and the exact case-insensitive managed login. A failing regression first reproduces the remote false positive; it then covers local protection, remote availability, case consistency and unrelated prefix names. Aède still authorizes each request, including parental locks and last-administrator retention.

Inspection also follows pending remote login rejection, token release outside the native owner lock, local engine stop after configuration failure, captured account request tickets and mutation-role rechecks. No further demonstrated defect is established in those inspected paths. All 53 selected frontend cases across ten suites, 11 native-session harness cases and two core managed-principal guard cases pass, with App TypeScript, lint, Rustfmt and touched-file formatting/diff checks. Earlier Aède and full-core results remain separate checkpoints; neither source changes in this confirmation. No App rebuild, real account mutation or commit is performed.

## Neighboring account-rights confirmation

The next pass establishes no new demonstrated production defect. Inspection follows the source-aware managed-account controls into native local protection, owner-bearing request tickets, accepted/rejected login publication, independent logout cleanup, local lease release and the live role check before account-private file writes. Earlier fixes remain preserved and no authorization rule is broadened.

One new test-only case exercises the actual native `private_write` function through a bounded loopback HTTP fixture. Its cached login says user, but GET session supplies the current account state before the write. Same-owner enabled user/admin responses admit the operation; auditor, disabled and mismatched-owner responses dispatch no write. Existing generation-replacement and logout cases remain intact. Fixture connection/header/body waits are bounded and only fictional credentials are used.

All 12 native-session harness cases, three independent-cleanup cases and two managed-principal cases pass (17 selected Rust cases), with all-target core Clippy, Rustfmt and touched-document formatting/diff checks. There is no frontend or Aède production change/test rerun in this confirmation. The actual native session policy is compiled outside Tauri; no App rebuild, real account mutation, physical acceptance or commit is performed.

## Final connection, logout and rights confirmation

The final requested pass establishes no new demonstrated defect in the inspected connection publication, rejected-token cleanup, source/name guards, independent logout/engine release and native/server privilege checks. Existing regressions are rerun unchanged; no production or test code is added in this confirmation.

All 18 selected Phémios Rust cases pass (12 actual native-session harness cases, three independent cleanup, two managed-principal and one malformed-config engine-stop case), alongside all 53 selected frontend cases. All 17 selected Aède account/API/authentication cases pass with isolated loopback sockets. These checks preserve refused late replies, current-session ownership, visible failures, private-write role checks, auditor refusal, revocation/expiry and private-data isolation. Prior Clippy/TypeScript checkpoints remain separate; neither is represented as a new full release gate here. Documentation formatting, Rustfmt and diff checks pass.

The Tauri command wiring remains inspected rather than App-compiled; the framework-independent native session source is compiled in the standalone harness. No physical/interactive account acceptance, App rebuild, real account mutation or commit is performed. All earlier pending corrections remain preserved.
