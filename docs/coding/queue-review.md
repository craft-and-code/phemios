# Queue composition review

The reviewed change set adds a transient shared queue workspace, exact contextual additions, reorder/removal/clear controls, bounded multi-category search and the Albums-only recent filter. The public catalogue and owner-private selections retain their separate admission rules. See [queue composition](../design/queue-composition.md) and [recent filtering](../design/recent-albums-filter.md).

## Confirmed defects corrected before commit

- A private M3U could resolve an ambiguous file path to the first matching placement. A single per-request index now refuses nonunique paths and removes repeated catalogue scans. Shared-file discovery retains root/exclusion/private-export isolation and original entries never cause file I/O.
- A DSP successor removed between selection and source opening could yield an empty reference. Membership and reference retrieval now share one state lock; the producer skips the retired candidate.
- HQPlayer selected while idle could admit an append because admission read the last effective device. Both initial and post-expansion checks now use the selected output, consistently with contextual Add controls.
- Repeated reads of a JSX thumbnail getter mounted three subtrees per row. Solid children resolution now mounts one thumbnail, preserves it through transport changes and disposes replaced/removed artwork.
- Detail routes inherit their originating navigation section. Footer/shortcut queue priority now requires the actual playlist workspace route, so opening a detail from it does not retain that priority.

Every defect has a regression, with the M3U, preload, HQPlayer, artwork-mount and route failures exercised before correction. Existing behavioral suites remain intact.

## Performance and limits

Artist resolution builds one reference index instead of searching all artists for every selected track. Cached artist/principal indexes are built only for the relevant search category. M3U expansion performs one catalogue index pass, then bounded per-occurrence lookup. The queue remains limited to 4096 occurrences and initially renders 100 rows with explicit expansion. Cached thumbnail rendering performs no network request on scroll. These are algorithmic and lifecycle improvements, not a measured whole-application memory, FPS or physical gapless guarantee.

The complete macOS Phémios gate passes 969 tests: 754 TypeScript, 19 Node tooling, 178 independent Rust core and 18 native bridge tests. Strict formatting/lint, frontend production build, declaration documentation, Storybook build, bridge compatibility, Rustdoc/Clippy and native executable build pass. Browser artwork replacement/removal checks confirm stable mount counts and cleanup. Aède has its own full verification record. Real acoustic continuity, live HQPlayer and Windows/Linux acceptance remain separate.

## Queue lifecycle confirmation (2026-10-19)

No new demonstrated defect was found in this scoped source review. Inspected paths include the shared drawer/workspace adapter, occurrence-specific additions, paused and stopped preparation, sparse occurrence removal and replay, reorder/drag cancellation, clear acknowledgement, asynchronous expansion lifetime and owner guards, lyric-control click isolation, and M3U browsing/publication/selection admission. Existing pending DSP and account corrections are preserved. No production code or tests were changed for this pass.

Existing checks pass: 152 frontend cases across 16 selected playback/queue/M3U/collection suites, and 57 independent Rust playback cases covering queue identity, append, removal, clear, overlap reservations and transport terminal responses. This is a source and automated-test checkpoint, not physical audio acceptance or a new native visual drag/drop verification. No App rebuild or commit was performed.

## Footer seek lifetime review (2026-10-19)

One demonstrated defect is corrected in the footer seek controller. If an earlier seek was still awaiting acknowledgement when playback changed naturally, a new occurrence's seek could be queued behind that old request and never dispatched. The controller now retires that coalescing lifetime on reference, queue identity or occurrence-index changes, both synchronously before admission and reactively. Late acknowledgements cannot replace the new pending cursor. Ordinary clock updates and rapid same-occurrence requests retain coalescing.

The regression fails before correction (only the old seek is sent) and passes afterwards, including a different track, a repeated track at another occurrence and replacement of a queue with the same track. All 90 selected frontend tests across seven seek, waveform, playback, audio-preference and contextual-control suites pass, as do TypeScript, targeted lint and diff checks. Source inspection also covers footer Play/Pause/Stop, next/previous/repeat, finite-duration toggle, owner-private favourite, source links, volume and output controls. This does not constitute native visual or physical listening acceptance. No App rebuild or commit.

## Footer pointer ownership follow-up (2026-10-19)

One related gesture-lifetime defect is demonstrated and corrected. The waveform previously retained only the pointer number: releasing a drag after a track/occurrence/queue change could commit a position against the replacement audio. A disabled timeline or component disposal also left the extracted handler able to commit. Pointer handling now captures reference, occurrence and queue identity, rejects stale moves/releases, and cancels capture/preview on unavailability, blur, pointer cancellation/lost capture and disposal. The handlers are extracted into a focused helper used directly by WaveformSeek; keyboard range events remain separate.

The original handler behavior fails five regression variants before correction. Seven gesture cases now pass, including explicit cancellation, release cleanup, unchanged-track clock/pause updates, foreign pointer refusal and single commit. All 97 selected frontend cases across eight pointer/seek/waveform/playback/preferences/contextual suites pass, with TypeScript, targeted lint and diff checks. No dependency was added, no App was rebuilt and no commit was created. Native visual capture and acoustic acceptance remain separate.

## Footer terminal-seek cancellation (2026-10-19)

One neighboring cancellation defect is reproduced and corrected. When a track reached ended/error with its reference retained, the seek controller cleared the displayed pending cursor but could still dispatch a coalesced position after the outstanding reply arrived. Terminal states now retire the request lifetime and queued positions; new terminal-state seeks are refused. Scope is rechecked on both success and failure before interpreting a delayed reply, so a retired failure cannot replace current feedback. Connecting/paused playback retains the existing acknowledgement path.

The ended/error regressions fail before correction by observing a second native send after termination. Six terminal-response variants now cover idle, ended and error with late success or rejection and refusal of a new seek. All 103 selected frontend cases across eight seek/pointer/waveform/playback/preferences/contextual suites pass, along with TypeScript, targeted lint and diff checks. Neighboring pointer capture, finite-duration, volume/crossfade lifetime and podcast seek paths were inspected without another demonstrated issue in this pass. No App rebuild, physical listening acceptance or commit.

## Footer output-result isolation (2026-10-19)

One asynchronous feedback ownership defect is demonstrated and corrected. The output selector previously inspected the shared error message after its transport action completed. An independent volume failure during a successful output switch therefore reverted the selected device, leaving the displayed choice inconsistent with the accepted command. Rollback now uses that action's explicit refusal outcome and requires the original controller lifetime, interface profile and selected output. A retired action has no rollback authority over a replacement session.

The regression first fails with the selected output reset to the system default despite a successful output command. Three cases pass after correction: successful output with independent volume failure, actual output refusal, and late refusal after reset with a new output/error. All 106 selected frontend cases across eight footer/seek/pointer/waveform/playback/preferences/contextual suites pass, along with TypeScript, targeted lint and diff checks. No dependency, native audio algorithm or App build changed; physical output routing remains separate acceptance. No commit.

## Footer crossfade-feedback follow-up (2026-10-19)

One neighboring feedback defect is demonstrated and corrected. A successful delayed crossfade write unconditionally cleared the shared playback error, including an independent volume refusal that arrived while the fade write was pending. A valid explicit fade choice now clears prior feedback at admission, consistently with other explicit controls, and its eventual success no longer erases an intervening failure. Existing lifetime/profile checks still reject retired acknowledgements and errors. Audio processing and transport scheduling are unchanged.

The regression fails before correction with an empty message instead of the intervening volume failure. An additional case confirms a refused fade can be explicitly retried and its previous error cleared while the saved duration is updated. All 108 selected frontend cases across eight footer/seek/pointer/waveform/playback/preferences/contextual suites pass, with TypeScript, targeted lint and diff checks. Related error-clearing sites, output result ownership, source transition stops and pointer/seek cancellation were inspected without another demonstrated defect in this pass. No App rebuild, physical output test or commit.

## Footer neighboring-path confirmation (2026-10-19)

No new demonstrated defect was found in this scoped follow-up. Inspected paths include crossfade/volume coalescing and feedback, command-specific output rollback, late completion after reset/revocation/profile replacement, pointer ownership and capture release, terminal seek cancellation, duration controls and radio/podcast footer adapters. Existing pending corrections remain unchanged; this pass modifies documentation only.

All 1,067 frontend cases across 227 suites pass, including the 108 selected footer-related cases from the preceding checkpoint. App TypeScript, targeted footer/controller lint and diff checks pass. No App, site or component explorer rebuild, native hardware acceptance or commit was performed. This is confirmation of the inspected paths and automated regressions, not a guarantee against all possible runtime faults.
