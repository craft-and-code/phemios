# Library hardening review — 2026-10-19

## Scope and evidence

This source review covers Artists, Albums, Tracks, Compilations, Countries, Genres, Composers and Labels, together with their artist/album/track/label detail entry points. It follows filtering and histogram projections, source-qualified identity routing, bounded pagination, optional analyses/lyrics, biography links, annotation admission and artwork recovery. It is a scoped review, not a claim that all defects or vulnerabilities have been eliminated.

## Demonstrated issues and changes

- Album/Track detail resources and optional track analyses keyed only by reference could retain the former login's data after logout or skip re-reading when the login changed but the reference stayed equal. `createCatalogDetail` now delegates to the existing diagnostic-read admission mechanism with reference and session identity. These views share that contract instead of repeating the reference-only resource pattern. Detail requests carry their captured native owner; guarded album pagination stops dispatching further windows after that owner is retired.
- Label rail initialization ran only once for a mounted page. Moving between labels could retain the previous label's years and hide the next label's albums. `createLabelSelection` scopes initialization, intervals and reverse order to the selected label/login, while retaining edits during an unchanged scope.
- Album histograms omitted releases without a known artist even though album filtering included them. Such editions now contribute to the histogram when no artist facet excludes them. The Compilations header also receives only compilation editions, matching its rendered results rather than counting the entire catalogue.
- Opening a release year retained recent-only/composer criteria from the preceding selection. The year action clears those unrelated restrictions along with the existing alphabet/country/genre/search reset.
- Legacy logo recovery published rejected reads after scope replacement or gallery disposal. Error publication now checks the captured scope, current visibility and lifetime, as the dispatch path already does.

Behavioral regressions first fail for the reference-only resource policy, retained label domain, missing histogram entries, stale year criteria and obsolete logo diagnostics. Additional coverage verifies that a retired album-page read cannot issue the next request under another login.

## Security and performance boundaries

Reference/login generation guards protect presentation admission; they do not replace Aède/native authorization. Public catalogue facts remain shared by design and account annotations remain personal. Optional network requests are explicit and never introduce arbitrary file or shell access. Existing text rendering, safe external-link projection, native routing and bounded catalogue parsing are retained. No new exploitable HTML/script injection or source-file write is established in the inspected paths.

Retired album reads now stop before subsequent windows, avoiding unnecessary reads during navigation/logout. Existing immutable catalogue indexes, bounded paging and artwork queues remain in use. No whole-app latency/memory benchmark or performance gain is claimed. Cover Flow rendering, motion and caching are unchanged. No additional dead production module requiring removal is demonstrated; obsolete imports and the removed audio notice's unused translation are removed.

## Verification

All 973 frontend tests in 217 files and 25 Node tests pass. Strict App/Storybook TypeScript, Oxlint, touched-file Prettier and diff checks pass. No test is removed or disabled. Rust/native compilation, app/site/Storybook builds, physical playback, receiver acceptance and non-host platform execution are not run in this pass. No dependency, commit or publication is introduced.

The audio popover no longer repeats the bit-perfect limitation underneath its unavailable option. Crossfade still requires the DSP mode in the current native actor: mixing transforms samples, independently of whether normalization/equalization is desired. This review does not alter that processing policy.

## Neighboring-call follow-up — 2026-10-19

Three additional issue groups are reproduced and corrected:

- The optional lyrics reader retained a former value across logout/re-login with the exact same session object while its replacement read was pending. A reference/login-generation token now admits retained text without discarding same-owner words on ordinary collapse or playback clock updates. Native reads carry the captured owner; disposal hides presentation. The existing Suspense, error and clock-stability tests remain intact.
- Missing-album suggestions could submit a private decisions read after logout during the capability request, and retained set-aside decisions could reappear on return to the same session object. Each source now owns a separate session/catalog generation. All page boundaries check admission, requests carry the captured owner and retired responses cannot regain visibility. Existing account and artwork policies remain unchanged.
- A label's initially full year interval did not follow later synchronization that added older/newer releases. Full-domain selections now follow the changed domain; explicitly narrowed intervals are retained and clamped rather than reset. Label/login replacement still initializes a new selection.

Seven added cases cover these observations and the requested UPnP address policy; the disposal assertion also confirms an existing safe behavior rather than being counted as another discovered defect. Verification passes 980 frontend tests in 219 files and 25 Node tests, strict App/Storybook TypeScript, lint, touched-file formatting and diff checks. No rebuild, commit, new dependency or physical receiver acceptance is performed.

The output popover uses an actionable crossfade instruction instead of suggesting the feature cannot be used. UPnP reuses an explicit private IPv4 from the selected remote URL, with a pencil override; local engines, loopback, DNS, public hosts and IPv6 retain manual input. This avoids guessing a server-side interface from a hostname or NAT/proxy route. Starting UPnP stops current local playback, but subsequent local transport commands remain independent; simultaneous playback is possible if the local player is explicitly restarted. No unified/exclusive output-routing claim is made.

## Pagination and label-resolution follow-up — 2026-10-19

Two neighboring request-chain defects are reproduced before correction:

- A retired Tracks read still requested later catalogue windows. The shared diagnostic admission now crosses the combined reader and capability/search chain. Every native read captures the selected login. Pending cache entries whose admission has retired are replaced; their late rejection cannot delete the replacement entry. Confirmed pages remain reusable, and completed entries release their old admission closure. The already submitted native request may finish; no transport-abort guarantee is made.
- Album label resolution continued issuing label reads after its detail context retired. The metadata component now shares `createCatalogDetail` with Album/Track details instead of keying a resource by serialized server/account ID. The album-to-label chain checks captured admission before and after each request and carries its native owner throughout, so it cannot dispatch the next label under a replacement account.

Five new behavioral cases cover cancellation during the initial probe, an already retired window, replacement pending-cache ordering and retirement before/between album label reads. Existing catalogue order, page sizes, epoch checks, source failure handling and label association assertions remain intact. All 985 frontend tests in 219 files and 25 Node tests pass, with strict App/Storybook TypeScript, Oxlint, touched-file Prettier and diff checks. No rebuild, commit, new dependency, source-audio write or physical playback acceptance is performed. No additional demonstrated defect is reported from the other inspected neighboring filter, source, suggestion and optional-read paths.

## Secondary-read confirmation — 2026-10-19

The inspected neighboring paths establish no additional production defect in this pass. Review follows capability-to-page admission, album labels, optional lyrics, missing-cover queues, completion-state reads, biography cache/revalidation and label range refresh. Existing confirmed-page cache reuse, exact source ownership and current-session guards remain unchanged.

Three test-only cases extend previously thin coverage: a full 200-row missing-suggestion page completing after logout or disposal must not submit page two, and a full completion-state page arriving after logout must neither fetch another page nor expose its rows. All three pass without production changes. The 53 selected cases across ten related suites pass, with strict App TypeScript, repository Oxlint, touched-test formatting and diff checks. This is a targeted confirmation rather than a new complete-suite count. No rebuild, commit, dependency, native execution or live-account action is performed.
