# Search hardening — 2026-10-19

## Demonstrated defect and correction

AdvancedSearchPage originally awaited the capability probe before capturing its account and dispatched subsequent calls using the default native session. A change of account during that probe could therefore submit the old expression under the replacement account. Leaving the route or replacing a search also failed to retire its chained reads and optional achievement publication.

The page reader is extracted into advanced-track-read.ts. Two failing behavioral regressions demonstrate continued search/achievement dispatch after retirement. Each chain now captures its owner before the first await, passes that owner explicitly to all IPC calls and checks admission between awaits. The view uses the shared diagnostic-read controller for route disposal, owner changes, query/page replacement and stale-result refusal. The combined source reader receives that same admission for secondary windows. Existing retained criteria/results remain session-scoped; confirmed route-remount cache reuse is preserved. Already dispatched native calls may finish; this correction retires their presentation and further dispatch, not physical network cancellation.

Five new cases cover capability-probe retirement, cancellation during a search, exact-owner successful requests, first-page achievement behavior, account replacement and refusal before native dispatch. Existing shared-reader, queue-search and retained-search tests remain unchanged.

## Other inspected paths and limits

Inspection includes catalogue folding and cached metadata, contextual wording, advanced-expression quoting/ranges, retained result lifetimes, queue category/debounce/pagination and public radio/Encyclopedia request admission. No further defect or measured performance gain is established in those inspected paths. This does not certify every engine query or live-provider response. No external provider, user-account operation or native visual acceptance was performed.

## Encyclopedia presentation

The reader frame no longer changes border color on hover. Its return-to-top action uses a contained sticky slot inside the padded article, instead of a viewport-fixed button overlapping the frame. The artist biography reader retains its existing floating placement.

## Verification

All 1032 frontend tests in 224 files and 25 Node tests pass, alongside App/Storybook TypeScript, lint, touched-file formatting and diff checks. No application, site or Storybook rebuild and no commit is performed.

## Neighboring search-chain confirmation

The follow-up inspects queue-search owner forwarding, debounce and category retirement, advanced-search pagination/capability/achievement admission, retained result scope and public article-search cancellation. No additional defect is demonstrated in these paths.

Four integration cases exercise the actual diagnostic controller, combined-source reader and advanced-page request chain together. Cancellation, logout, disposal and account replacement during a deferred capability probe dispatch neither the retired search nor later windows/achievements. A successor account can complete its own search without old feedback replacing it. The tests pass without a production logic change; this is confirmation of the preceding correction, not four newly discovered bugs.

The Encyclopedia article frame now has an explicit bottom margin and cannot shrink as a flex child into its long text, retaining space after saved-article content. No browser/native visual acceptance or rebuild is claimed. All 56 selected search cases in seven suites pass, with App/Storybook TypeScript, lint, touched-file formatting and diff checks. No commit is performed.

## Saved-reader bottom-space correction

The initial article margin did not reserve visible bottom space: the remaining-height flex page stayed bounded while its long reader overflowed it. A temporary browser fixture rendered the real WikipediaReader with the actual app/page/panel CSS and a fictional thirty-section article. At maximum scroll the frame ended at the main viewport edge (0.09 px gap). Letting the article page and panel size to their contents retains the existing page bottom padding: the same browser measurement becomes 36.09 px. The ineffective extra reader margin is removed. The temporary fixture is deleted after the check; no account/private article was used and no build or commit was performed.
