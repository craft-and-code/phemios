# Settings lifecycle review

## Scope

This source review inspects settings tab navigation, language/theme and menu/shortcut persistence, account and parental controls, library/scan actions, service keys and enrichment, audio configuration, imports and application-backup lifetimes. It is not a native visual review of every tab. Earlier pending corrections are preserved; Aède is unchanged by this pass.

## Demonstrated defect and correction (2026-10-19)

The shared service-key save completed by updating the current profile's Fanart enrichment toggle after two asynchronous operations. If the interface profile changed during native key persistence or status refresh, this callback could activate/deactivate enrichment in the replacement profile. The keys themselves are deliberately device-wide; this finding is a stale personal preference mutation, not demonstrated credential disclosure.

The actual save/refresh/commit sequence is isolated into a focused helper. Both delayed-stage cases fail before the guard correction, by observing a retired commit. The view captures its interface identity and lifetime, checks them across the sequence and guards late failure feedback. The native device-wide operation already admitted is allowed to finish; it is not claimed to be remotely undone. Current saves still refresh status before applying their preference, failed saves/refreshes never commit, and later edited key fields are not cleared as an earlier draft.

## Verification

All 1,088 frontend tests across 229 suites pass, including five service-key completion cases and existing preference/account/backup/import/generation coverage. App and component-explorer TypeScript, targeted Settings/helper lint, formatting and diff checks pass. The first TypeScript check identifies the status-refetch callback's nullable synchronous return; wrapping it in an async adapter resolves its declared Promise contract before final checks.

No further demonstrated issue is established in the other inspected settings paths. No dependency, native App/engine rebuild, physical device test or commit is introduced. Existing pending code and documents remain uncommitted.
