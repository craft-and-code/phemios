# Tools hardening — 2026-10-19

## Scope

Tools comprises Relations, Encyclopedia, Achievements, Diagnostic, Analyses, Statistics and External players. This pass reads their presentation controllers and relevant shared parsers/request boundaries, with focused inspection of native transfer ownership. No physical transfer, remote write or native execution is performed.

## Demonstrated defect

The achievement parser accepted safe-integer Unix seconds outside JavaScript Date's supported range. The actual Intl.DateTimeFormat call in AchievementsPage then threw RangeError while rendering an otherwise accepted result. A failing behavioral regression reproduces this boundary; the parser now rejects seconds above 8,640,000,000,000 before the result reaches the view. Zero, normal timestamps and the maximum supported date remain accepted.

A second test exercises the actual achievement read controller: a malformed unlock date remains a local diagnostic, and a later explicit refresh recovers from a valid response. No achievement definition, opaque locked entry or persisted unlock is changed.

## Other inspected paths and limits

- Relations bounds graph work through neighbours, rejects dangling/self edges and keeps provenance separate from group membership. The SVG interaction owns no idle animation loop.
- Encyclopedia exploration uses generation checks for search/read/edition/download feedback and exact-session native storage for personal copies. Inspection includes retained-copy validation and the bounded, plain-text analysis/document surfaces; compatibility stores are not automatically attributed to accounts.
- Diagnostic and analysis coverage use the shared diagnostic admission. Imported reports remain separate from server coverage and do not change account records.
- Statistics uses epoch-checked readers and CSV escaping. The suspected table-refresh pagination issue is not retained: the current page already mounts tables under a keyed report boundary, so a new report recreates their offset state. The experimental extraction used to check that hypothesis was removed without production changes.
- External-player preview/start paths capture native owners and discovered destinations. Native status checks current owners before returning retained diagnostics. This inspection does not establish all filesystem, firmware or cross-platform device guarantees.

No further production defect, removed dead code, or measured performance gain is established by this pass. This is a scoped inspection, not a whole-application absence-of-defects claim.

## Verification and commits

The preceding Sources musicales lot was committed separately as c85e16c and 54bc392 after all 1016 frontend tests and 25 Node tests passed with static checks. The Tools work remains uncommitted.

For Tools, all 1018 frontend tests in 221 files and 25 Node tests pass, with strict App/Storybook TypeScript, repository lint, touched-file formatting and diff checks. Two added cases preserve the preceding suite. No application/site/Storybook rebuild, Rust compilation/tests, new dependency, live-account mutation or hardware acceptance is performed.

## Transfer progress ownership follow-up

A failing regression reproduces private transfer paths remaining in the External players view after account replacement. Two further failing cases reproduce a late native status or error crossing an account round trip. The native status endpoint already checks its owners, but the frontend could retain a previously admitted projection or publish a response that was captured before logout.

The polling state was first extracted unchanged from PlayersPage into a focused controller, then bound to the exact Local/Server session generation. Replacing either session clears file names, counts and diagnostics from retained progress. Only the device-wide running boolean remains until a fresh native read confirms it; this avoids unlocking destination actions while an old transfer is still stopping. Old response/error publication is rejected, reads remain serialized, and disposal refuses further polling. The native copy/cancel protocol and timer cadence are unchanged.

Five cases cover retained private data, late success/failure after an owner round trip, replacement-owner recovery without overlapping reads, current error visibility and disposal. Similar date/format callers were also inspected; Wikipedia already rejects out-of-range retrieval dates, and no further formatter-crash defect is demonstrated in this pass. Native filesystem transfer behavior is not newly certified.

All 1023 frontend tests in 222 files and 25 Node tests pass, with App/Storybook TypeScript, lint, touched-file formatting and diff checks. No rebuild or commit is performed.

## Biography copies and neighboring ownership confirmation

This follow-up establishes no new defect in the inspected neighboring ownership, deferred acknowledgement and article parsing paths. The user-requested biography action is implemented separately: a heart immediately precedes the existing file Download action in the dedicated reader. It reuses the same native account-private article store and exact-session tickets as Encyclopedia, with no new store, provider request or persistence schema. The full existing Wikipedia text, edition, revision and attribution are retained; local images remain presentation data. Saving is disabled without a writable native account, during loading/writes, or when the exact revision/text is already retained. A newer revision may replace the same page/language. Read/save failures use the account-scoped diagnostic.

The storage projection is mounted only with the complete biography reader and retired on leaving it. Account/source changes clear the private projection and refuse late writes/feedback. A shared exact-edition predicate now serves both biography and Encyclopedia, preserving the existing comparison behavior. Saving belongs to the active account, independently of the public artist catalogue's origin. Copies are available through Encyclopedia's FR/EN saved-article filter and existing personal backup.

Two added unit cases cover exact revision/language/text detection and the actual complete-biography/read → private save → recreated Encyclopedia store flow. Existing account-store refusal, corruption and replacement cases remain unchanged. Two Storybook scenarios cover the action's order/retained and disconnected states; only their TypeScript is checked here, not browser execution or a Storybook build.

All 1025 frontend tests across 223 files and 25 Node tests pass, plus App/Storybook TypeScript, lint, touched-file formatting and diff checks. No rebuild, commit, dependency addition, live-account operation or physical-device validation is performed.

## Encyclopedia contents and saved-biography confirmation

This inspection establishes no new production defect in the reviewed article ownership, delayed save acknowledgements, cancellation admission and neighboring diagnostic reads. The Encyclopedia reader now includes the requested contents navigation and reuses ScrollToTop for both public and saved articles, including retained biographies. Its focus target accepts the reader's h2 title as well as the biography reader's h1. Section navigation uses block positions rather than title identities, so repeated heading names remain distinct. Text remains literal; the contents list introduces no HTML parsing or provider request.

Two additional account-store cases confirm logout/return to the exact same session object and disposal while a save and a queued mutation are pending: retired completion/error is suppressed and the queued mutation is never dispatched. Already submitted native writes are not claimed to be physically cancelled; native exact-session/private-write admission remains responsible for storage ownership. The public biography reading cache and private saved-article store remain separate.

All 1027 frontend tests across 223 files and 25 Node tests pass, plus App/Storybook TypeScript, lint, touched-file formatting and diff checks. No rebuild, commit, new dependency, live account mutation or native/browser visual acceptance is performed. Inspection is scoped and does not certify absence of defects throughout Tools.
