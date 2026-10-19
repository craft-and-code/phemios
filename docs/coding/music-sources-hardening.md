# Music sources hardening — 2026-10-19

## Scope and evidence

The section comprises Radio, Podcasts, Audio CD and Concerts. This pass inspects asynchronous playback admission, stop/pause and disposal, account-scoped favourites/subscriptions/download feedback, provider paging/cache bounds, and the existing native public-network and JamBase budget boundaries. It does not establish hardware acceptance or a complete native security audit.

## Demonstrated defect

Podcast Pause returned immediately before a media element existed. If stopping the preceding source was still pending, Pause was ignored and the episode could start once preparation completed. Two failing regressions reproduce this for both a successful and a rejected deferred preparation.

Pause now retires the current play attempt whenever an episode is selected, including before media creation. The post-preparation admission also checks that attempt, preventing creation/output and obsolete errors after Pause. Resume explicitly starts the selected finite episode when no media was created; already-created paused media retains its existing position and element. Existing owner, authorization, volume, played-range and stall tests remain unchanged.

## Other inspected paths and limits

Radio directory reads and stream resolution remain separate from account favourites. The inspected tuner/search paths retain explicit-gesture admission, bounded pages and disposal checks. Podcast account projections retain exact source/session ownership, serialized native writes and bounded data validation. The CD DTO admits bounded opaque drive/disc identities and keeps optical playback independent of Aède; native CUE selection remains confined to its explicit file dialog. The JamBase review examines fixed HTTPS requests, sensitive authorization headers, bounded pagination and the persisted, locked, fail-closed request budget. No further demonstrated defect or measured performance improvement is claimed from these inspected paths.

Public event/directory metadata and private subscription/favourite selections have different ownership; this pass does not attribute legacy device records to accounts or remove compatibility readers. No new dependency, automatic enrichment or source-audio mutation is introduced.

## Verification

All 1012 frontend tests across 221 files and 25 Node tests pass, with strict App/Storybook TypeScript, repository lint, touched-file formatting and diff checks. Two added tests preserve prior behavior/count. No App/site/Storybook rebuild, Rust compilation/tests, live provider/key operation, physical CD/renderer acceptance or commit is performed.

## Deferred preparation confirmation

This follow-up establishes no additional production defect in the inspected neighboring transitions. Four added cases exercise the precise remaining interleaving: Pause during pending preparation, explicit Resume before that old preparation settles, then either old success or old rejection. They exercise both finite podcasts and the live-radio Resume command. Only the current media is played; the old attempt cannot resolve another radio URL, replace current status/errors, release resumed media or create another podcast element.

Inspection also covers parental-media authorization/lease retirement, radio directory/favourite ownership, podcast account/download feedback and CD/JamBase admission boundaries. These checks do not establish a complete audit of native implementations or provider behavior.

All 140 selected cases in 27 suites pass (Sources musicales and parental-media), with App TypeScript, lint, touched-test formatting and diff checks. The radio suite is rerun after switching its regression to the public Resume command. No new production change, rebuild or commit belongs to this follow-up. The preceding full-suite checkpoint remains separate; physical media/provider acceptance and Rust execution remain unperformed.
