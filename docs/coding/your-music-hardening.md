# Your music hardening — 2026-10-19

## Scope

The review covers Moods, Favourites, Rated albums, Tags, Collections, History and Playlists, including the shared queue and explicit M3U browser. It follows source/login admission, retained personal data, deferred actions, per-item detail workers, private paging and bounded playback selection. It does not repeat a native/network-engine audit or claim complete absence of defects.

## Demonstrated issue groups

1. Personal page admission compared session/path/offset fields rather than the read generation. Returning to the same session object after logout could expose a retained collections/history response while the fresh read was pending. Admission now requires the exact scope object and a live reader. Same-scope background history refreshes retain their row identities; private requests carry the captured native login.
2. The tag detail window kept dispatching its remaining work after its presentation had retired. Its two workers now check admission before and after each read, while preserving the ten-item window and per-item failure behavior. TagsPage uses the shared diagnostic reader and captured per-source owners so old results/errors cannot populate another window or login.
3. Mood response retention compared session/source/selection fields without a login-generation token, and its capability-to-private-page chain continued after retirement. Captured ownership now covers both requests, retained page/capability/error admission and deferred command feedback. Read errors stay inside the page. Mood drafts, busy indicators and diagnostics reset on account/source replacement; late command results are discarded. Queue construction uses the existing player read-selection admission, with checks before each bounded page and captured native ownership.

Failing behavioral cases reproduce all three groups before correction. Additional cases cover current-owner mood capabilities, invalid pages, already retired admission and history-reader disposal. Existing history timer/DOM stability, personal action generations, per-item tag errors and player-selection cases remain in place.

## Other inspected paths and limits

Favourites/rating projections keep current-account annotations separate from the shared catalogue. Collection playback retains bounded exact membership and catalogue epochs; creation/deletion/rename admission is checked at its request boundaries. M3U inventory/detail paths retain validated IDs, inert file previews and the shared account-scoped diagnostic reader. The shared queue retains its native occurrence/generation controls. No further production defect is demonstrated in these inspected paths, and no source-audio write, new dependency or external automatic request is introduced.

Avoiding retired tag/private-page requests reduces unnecessary work; no benchmark or whole-app performance gain is claimed. Scope checks complement native/Aède authorization rather than replacing it. Already submitted native/server work may finish; retiring presentation does not promise remote job cancellation.

## Verification

All 995 frontend tests in 220 files and 25 Node tests pass. Strict App/Storybook TypeScript, Oxlint, touched-file Prettier and diff checks pass. Seven added tests preserve the previous suite. No app/site/Storybook build, Rust/native compilation, physical playback, live-account mutation, commit or publication is performed.

## M3U download acknowledgement follow-up

A failing regression demonstrates that field-equivalent M3U scopes could revive an obsolete download acknowledgement after logout/navigation and reselection of the same file. The download now captures the exact selection object and scope at dispatch. Returning to an equivalent scope, selecting the same file again, or disposal cannot publish its old success/error feedback. This retires presentation feedback only; an already submitted native download may finish.

Two added cases cover equivalent-scope replacement and same-file reselection. Neighboring collection creation/playback/export, rename/delete and history-reset request boundaries were inspected; this pass establishes no additional defect there. All 997 frontend tests in 220 files and 25 Node tests pass. Strict App/Storybook TypeScript, Oxlint, touched-file formatting and diff checks pass. No rebuild or commit is performed.

## Queue lyric lifecycle follow-up

Two failing regressions demonstrate remaining lifecycle defects in queue lyric acquisition. The multi-source capability loop continued to the next source after Stop during its first request. Completed batch diagnostics also became visible again after logout and return to the same session object. The controller now checks admission before and after each capability request and retains an exact reactive captured-account scope for both work and feedback. Queue edits and drawer closure do not retire this account scope; existing continuation tests remain unchanged.

Four added cases cover completed-feedback retirement plus cancellation, logout/return and disposal during a deferred first-source capability response. The inspected availability worker, queue ordering/duration, collection mutation/playback helpers and history action projection establish no further defect in this pass. No remote cancellation of already accepted work or measured whole-app performance gain is claimed.

All 1001 frontend tests across 220 files and 25 Node tests pass, together with strict App/Storybook TypeScript, Oxlint, touched-file formatting and diff checks. No build, native reconstruction, commit, dependency addition or live-account mutation is performed.

## Delayed cancellation acknowledgement follow-up

A failing behavioral regression demonstrates that a delayed server-cancellation error from a stopped lyric batch could overwrite the diagnostic of a subsequently started batch on the same account. Cancellation now captures the original feedback scope and checks it before reporting failure. Same-batch cancellation errors remain visible; accepted native/server work is not replayed or moved between accounts.

Two cases cover the obsolete cancellation response and the still-current failure. Neighboring M3U selection admission, queue search/category paging, lyric availability, mood commands, collection helpers and history projection were inspected without demonstrating another defect in this pass. All 1003 frontend tests in 220 files and 25 Node tests pass, with strict App/Storybook TypeScript, lint, touched-file formatting and diff checks. No rebuild or commit is performed.

## Selection collection dialog follow-up

A failing regression reproduces private collection names remaining in confirmation feedback after logout. The same retained dialog state also kept an unsaved draft when the account was replaced. The state was first extracted unchanged from SelectionCollection into a focused controller for behavioral testing, then connected to the existing personal-action lifetime guard. Draft, name, errors, busy state and confirmation reset on source/account changes. Deferred saves capture the submitted name and cannot close or clear a successor dialog after an account/source round trip or disposal.

Four added cases cover retained private feedback/drafts, account/source round trips with a newer save pending, and disposal. Neighboring download feedback, export state, queue-add/search, queue ordering and lyric cancellation paths were inspected without demonstrating a further defect in this pass. All 1007 frontend tests in 221 files and 25 Node tests pass; strict App/Storybook TypeScript, lint, touched-file formatting and diff checks pass. No rebuild, commit, dependency addition or live-account mutation is performed. No whole-app absence-of-defects or benchmark claim is made.

## Neighboring acknowledgement confirmation

This pass establishes no new production defect in the inspected neighboring acknowledgement paths. Three added behavioral cases verify that a retired download rejection cannot reset a newer pending download, and that a delayed lyric-cancellation error remains hidden after an account logout/return or controller disposal. Existing tests continue to require current cancellation errors to remain visible and replacement-batch diagnostics to remain untouched.

The targeted verification covers download/export state, queue lyric acquisition/availability, M3U selection, selection-collection state, collection save/rename helpers, personal action admission and queue-search lifetime. All 63 selected tests in ten files pass, with App TypeScript, repository lint, touched-test formatting and diff checks. No production code change, rebuild or commit belongs to this pass. The preceding full-suite result is a separate checkpoint; no whole-application absence-of-defects claim is made.
