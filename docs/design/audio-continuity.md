# Native PCM continuity and resource boundaries

Phémios consumes Aède PCM through a fixed-capacity ring. CPAL owns its consumer; the socket actor or DSP crossfade mixer owns its producer. The device callback performs no allocation, lock, network operation, logging or thread join. Audio format selection remains explicit and limited to supported mono/stereo output at 8–192 kHz.

## Scheduling reserve and consumption evidence

The output ring retains its existing half-second capacity: `rate / 2` stereo frames, or `4 * rate` payload bytes (32,000 at 8 kHz, 192,000 at 48 kHz and 768,000 at 192 kHz). Startup, a reset and recovery after starvation wait for a 100 ms reserve inside that ring. This is a sample-rate-derived scheduling policy, not a larger allocation or a guarantee against arbitrary host stalls. A known completed source drains even when shorter than the reserve. The DSP mixer marks completion only after the queue has no successor; individual crossfade boundaries retain continuous output.

Held PCM, pause silence, starvation silence and discarded prefetch never advance the consumed clock or listening history. User pause/seek signals remain checked per frame. Existing 5 ms transport ramps apply to pause and resumed PCM; the reserve never changes the PCM spectrum calculation or user's gain.

Each callback publishes all its consumed frames before acknowledging a reset. The reset swaps that complete old-epoch count, discards the old ring and restarts the reserve. This prevents a callback-local count from being omitted from the old visit and later added to the new epoch. Reset polling occurs once per callback, after its output block; reset completion can therefore await the remaining block duration and the stop ramp. The existing one-second reset deadline remains an explicit failure boundary.

The additive native snapshot field `underrun_frames` counts intended output frames lost to an empty ring and the reserve hold that follows that starvation. Initial startup, reset reserve, user pause and known EOF drain are excluded. The count resets when a new output opens and spans all voices of a continuous DSP output. It measures callback starvation/recovery silence, not acoustic defects, operating-system mixer behavior or physical device failures. The frontend does not add a settings control or fabricate an audible-health guarantee from it.

## Native output notifications

CPAL's [`DeviceChanged` contract](https://github.com/RustAudio/cpal/blob/v0.18.1/src/error.rs#L15-L17) means the backend has automatically rerouted an active stream. Phémios continues supplying that stream rather than treating the notification as a fatal failure. The pinned CPAL 0.18.1 source documents the same behavior. Other error kinds retain the existing fatal policy, including actual device unavailability, invalidated configuration and backend failures. A later successful reroute never clears a preceding fatal flag.

The error callback classifies the copied error kind and, for fatal events, performs one atomic store. It introduces no thread, allocation, mutex, logging or error-string formatting. No additional fault-kind publication is required for this narrow correction. Synthetic callback tests cover continued consumption after the reroute notification and retained failures; they do not establish a physical route switch. This inherited classification defect is not identified as the cause of the separately observed QA failure, whose actual CPAL error kind was discarded.

## History confirmation stays outside active production

After an outgoing contribution is fully consumed, `Source::retire` requests stop on its existing socket worker and polls its completion without joining a running thread. Delayed history confirmation therefore does not block production of the active next voice. Cancelling an inaudible preload follows this same retirement route; that preload cannot become the audible track identity.

The mixer owns at most one current voice, one incoming voice and one retiring voice. It does not open a further preload while the retirement slot is occupied. This explicit budget prevents a queue of very short tracks from accumulating live sockets and workers. A successor shorter than a stalled preceding confirmation can still finish before another preload is admitted, so that later boundary may wait. Final Stop/Seek/output replacement still await confirmation, with the existing bounded socket/history deadlines. No seamless arbitrary sequence is promised under unavailable or delayed history storage.

The mixer publishes its final consumed contribution before a release stop request; the socket worker acquires that request before reading the final count. A terminal worker failure remains an error across repeated retirement/cleanup calls. Cleanup cannot reinterpret a consumed failed JoinHandle as successful history confirmation.

PCM messages remain limited to 32 KiB. Canonical stereo expansion holds at most 8,192 frames per mono message; each source channel has four packet slots and at most one pending packet. A voice's frame deque is polled only below 16,384 frames and can exceed that threshold by at most one packet. Neither path decodes or retains a complete track. The ring reserve and retirement changes introduce no extra PCM store, thread or dependency. These are logical payload bounds; socket buffers, container spare capacity, CPAL and WebView memory remain separate from total process RSS.

`output.rs` keeps device discovery, format dispatch and callback ownership together; `crossfade_source.rs` keeps the lifecycle of one authenticated socket worker together. Their small exceptions to the usual 250-line guideline preserve one coherent owner while numerical transport, mixing, spectrum and feedback policies remain separate modules.

## Verification and profiling

Behavioral coverage preserves the existing output/mute/RMS/pause/seek/crossfade tests and adds reset accounting, startup/reset reserve retention, starvation recovery with complete held-frame counts, short EOF draining and virtual producer stalls at 8/48/192 kHz. Local mock WebSocket tests deliberately hold a saved-history response while active production progresses, check that repeated retirement polls retain the same worker, retain later history errors across cleanup, and compare final stop counts with PCM consumed after the preceding ACK. These checks do not open a physical output.

The separate `core/examples/audio_callback_profile.rs` harness includes the existing callback and filter-bank source; it has no independent algorithm copy and is excluded from behavioral test builds. Run from the repository:

```sh
cargo run --release -p phemios-core --example audio_callback_profile
```

On the development macOS host, a first optimized synthetic run of 30 seconds of stereo input in 256-frame blocks measured 85.287 ms callback wall time at 48 kHz (0.284% of source duration) and 341.466 ms at 192 kHz (1.138%). Independently measured spectrum-bank times were 80.321 ms and 351.062 ms; separate-run scheduling noise prevents treating their difference as exact remaining callback cost. The sampled maximum callbacks were 34.625 µs and 87.750 µs against 5,333 µs and 1,333 µs block periods. These are bounded synthetic host observations, not operating-system scheduling guarantees, whole-app CPU benchmarks or physical audio acceptance.

The extracted example was also run while native builds and behavioral checks were active. That observation measured 261.894 ms at 48 kHz (0.873% of source duration) and 925.151 ms at 192 kHz (3.084%); spectrum-only observations were 229.996 ms and 924.788 ms. Maximum observed callback intervals were 11.670 ms and 15.307 ms, exceeding those block periods. These wall-time observations include any scheduling interruptions and do not isolate the exact cause of each outlier. The earlier hot-block profile and this half-second-ring harness are useful bounded workload observations, not a before/after performance comparison. They demonstrate why a fast arithmetic average cannot guarantee device deadlines under host load.

The fixed 24-band stereo mathematics remains unchanged: no decimation, reduced band count or asynchronous display worker is introduced from this evidence. The profile harness reports timings rather than enforcing fragile wall-time test thresholds. Sequential per-track reconnections without DSP overlap, minimum-toolchain execution, other platforms, digital-output capture and acoustic acceptance remain separate work.

## Remote timing admission follow-up

The DSP/fade review reproduces one protocol defect: `format` admitted `u64::MAX` as a remote duration, although the mixer's remaining-frame conversion multiplies duration milliseconds by the negotiated rate before division. This can overflow (panic with checked arithmetic, wrapped scheduling otherwise). The same unchecked timestamp domain was accepted for source offsets and ordinary-stream reset positions.

A shared millisecond validator now requires the rate multiplication to fit `u64` before those values enter playback state. Epochs and frame counters retain their own unsigned domain. No new user-facing track-length policy is imposed; the bound follows the actual conversion arithmetic. Two cases cover oversized duration/offsets, the exact representable boundary, reset-position admission, zero-rate refusal and independent epoch counters.

The review also inspects convex overlap gain, consumed-frame attribution, seek generations, source retirement and bounded PCM queues, pause/reserve ramps, callback ownership and the signal-processing/normalization interfaces in Aède. No further defect or measured performance improvement is established in these inspected paths. The correction adds no callback work, allocation, buffer, worker or dependency and does not change DSP sound algorithms. Existing synthetic continuity evidence above remains a separate checkpoint; no physical output, OS scheduling or new performance benchmark is claimed.

Verification: all 54 selected Phémios playback cases and all-target core Clippy pass after the correction; all 81 existing Aède DSP library cases pass without Aède source changes. Rustfmt and touched-document formatting/diff checks pass. No application rebuild, physical listening acceptance or commit of this DSP correction is performed.

## Initial-offset cleanup deadline

The neighboring timing/lifecycle review demonstrates one further defect. A DSP source opened at a nonzero position sends an initial `seek` after its first format. Unlike subsequent seek requests handled by `Feedback::tick`, this branch set `seeking` without a confirmation deadline. If the peer kept the socket open without returning `reset`, a stop could not be sent while seeking and `Source::finish` could join that worker indefinitely. The mixer's own progress timeout did not bound the subsequent join.

The initial seek now arms the same twelve-second confirmation deadline as later seeks. A local WebSocket regression first fails while cleanup depends on the test peer's forced closure; after the correction the existing worker exits with an explicit unconfirmed-listening error while the peer remains open. A thirteen-second test watchdog releases the mock in both outcomes. Existing successful seek/reset and retired-confirmation cases remain intact. This changes no callback work, worker count, PCM buffer or gain algorithm.

Inspection also follows the neighboring format/reset millisecond conversions, overlap arithmetic, queue successor reservation, retained source generations and normal/CD progress deadlines. No additional demonstrated defect is established in those inspected paths. All 55 selected playback tests, all-target core Clippy, Rustfmt and touched-document formatting/diff checks pass. No App rebuild, physical device acceptance or commit is performed. The preceding numeric-admission correction remains uncommitted alongside this correction.

## Late-format stop confirmation

The next neighboring-lifecycle pass reproduces one distinct stop race. When Stop was sent before the initial format arrived, that delayed format still entered the active-format branch and cleared the already armed stop-confirmation deadline. An open peer that never confirmed history could then hold `Source::finish` indefinitely despite the existing stop timeout. This differs from the preceding missing initial-seek deadline: the deadline existed and was subsequently erased by a late reply.

Once the worker has sent Stop, queued format replies are now ignored. They cannot replace its epoch, initiate an offset seek or clear its deadline. Saved/error/close handling remains active. A real local WebSocket fixture first reproduces the lost timeout by sending format only after receiving Stop; after correction cleanup terminates with an explicit unconfirmed-listening error before the watchdog closes the peer. Existing successful seek/reset, saved-history and retirement cases remain passing.

Inspection follows all assignments to the shared deadline/seeking/stopped fields, source cleanup, mixer retirement and normal-stream stop handling. No additional demonstrated defect is established in those inspected paths. All 56 selected playback cases and all-target core Clippy pass, with Rustfmt and touched-document formatting/diff checks. No callback algorithm, allocation, worker or buffer changes; no App rebuild, physical output acceptance or commit.

## In-flight EOF after Stop

A further local WebSocket regression demonstrates one neighboring terminal-state defect: after Stop the source deliberately discards in-flight PCM, but still checked a queued EOF against its retained `sent` count. When that EOF included the discarded tail, cleanup failed with an inconsistent-end error before reading the valid `saved` response immediately behind it. No missing history confirmation or corrupt source was required.

The stopped-source guard now ignores both queued format and EOF messages, matching its existing binary discard. Live-source EOF epoch/frame validation remains strict; saved/error/close processing and the stop deadline remain active. The fixture sends Stop, delayed format, two unconsumed stereo frames, their EOF and a saved confirmation. It fails before correction and afterwards confirms successful cleanup without publishing discarded audio packets.

The neighboring feedback, mixer cleanup/seek, normal stop and spectrum ownership paths establish no additional demonstrated defect in this review. All 57 selected playback cases and all-target core Clippy pass, with Rustfmt and touched-document formatting/diff checks. No audio callback, signal algorithm, buffer, dependency or worker is added; no App rebuild, physical output acceptance or commit is performed.

## Terminal-response confirmation

The next pass establishes no new demonstrated production defect. Inspection follows other post-Stop responses, reset/seek/deadline transitions, worker cleanup, actor pause/output policy changes, callback reserve/reset accounting, convex overlap and spectrum publication. No measured performance improvement is claimed from source inspection.

One additional test-only local WebSocket case confirms that discarded binary/EOF tails do not hide a subsequent genuine history-storage failure. The precise server diagnostic remains visible, confirmation remains false and repeated cleanup retains the same failure. Existing saved-success and bounded-cleanup regressions remain intact. All 58 selected playback cases and all-target core Clippy pass, with Rustfmt and touched-document formatting/diff checks. This pass adds no production change, App rebuild or commit; preceding uncommitted fixes remain preserved. Physical listening and other-platform acceptance are not established by these software fixtures.

## Continuous album queues without DSP

Multi-track native Aède queues now reuse the bounded continuous-output transport also when DSP is disabled. Source workers retain the captured policy: `without-effects` requests `normalize:off`, while DSP requests album normalization. The mixer admits zero overlap outside DSP even if a nonzero fade duration was saved earlier or a fade control arrives during playback. It preloads the successor into the existing bounded packet/frame queues and retains the output ring/device across natural track boundaries. Single-track unprocessed playback and CD/HQPlayer routes remain separate.

This removes per-track output teardown/reopening as a possible source of transition artifacts; it does not rewrite source samples, insert a fade, guarantee device scheduling, or prove that a reported crack in a particular recording was caused by the transport. Abrupt discontinuities already present at file boundaries remain audible. Existing consumed-frame history, queue ownership, cancellation and retained-source budgets apply. A paired real WebSocket regression covers unprocessed and normalized source admission; policy cases cover zero-overlap selection and continuous album routing. Physical Danzig playback acceptance remains pending.

## Policy selection and failed preloads

Selecting DSP or without-effects no longer suspends the output or restarts the audible visit. The ordinary stream retains the desired policy for the next visit; the continuous queue uses it for future source preparation. Already prepared/audible voices keep their captured normalization policy, and incompatible policies are never crossfaded. This avoids reconnecting the current track, repeated listening visits and discarding valid buffered audio. It is not an immediate in-place change of Aède's decoder settings: a preloaded successor can still use the earlier mode, with the requested mode applied to subsequent preparations. The output panel describes this deferred behavior.

A real WebSocket preload-error regression demonstrates that an unavailable future track previously failed the active producer immediately. Future-source failures are now retained, excluded from overlap and reported after the current output is consumed; queued PCM remains bounded. Removing/cancelling such a failed but wholly inaudible visit retires its worker without re-publishing that known future error. Errors on rendered visits and missing history confirmation for audible audio remain errors. Queue membership is rechecked before deferred error publication, and completed-output state is cleared before promotion after cancellation/recovery.

The mode-control regression fails before the fix on a playing output's pause flag. The preload regression separately fails before error deferral and before inaudible cleanup handling. Existing source Stop/seek deadlines, canceled-account publication, output timing and consumed-frame assertions remain intact. No hardware listening acceptance or App rebuild is claimed.

## Active incoming failure classification

A neighboring regression extends the paired preload-error fixture: once the incoming voice has a scheduled start, polling must no longer classify it as wholly inaudible speculative work. Previously `poll_preload` retained every failure and returned success, including during an active overlap; the mixer could consequently wait for nonexistent incoming frames until its progress deadline. Reserved incoming voices now use the ordinary error-propagating poll. Truly speculative failures remain deferred, and cancellation/cleanup still ignores only a known failed visit with no scheduled start and no supplied frames. The new assertion fails before the correction and passes afterwards; the test count and earlier source/cleanup assertions are preserved.

## Cancellation before error observation

A real WebSocket regression demonstrates a race in both nonblocking retirement and final cleanup: an unplayed source can fail before `Voice::poll_preload` has copied its error into the mixer's `failure` field. Removing that preload calls retirement before the next preload poll. Requiring that field to be populated therefore propagated the worker error into the active producer and could cut the current track; final Stop could likewise fail for an unrelated unplayed source.

Cleanup now classifies the visit solely by contribution (`start` absent and `supplied` zero), after still retiring/joining the original worker. It does not depend on observing the error packet first. Scheduled/supplied visits retain strict failure and history-confirmation handling; normal forward playback still reports a failed future track at its turn. The new fixture leaves the mixer's error field unset and reproduces failures on both cleanup routes before correction. Earlier deferred-error, active-overlap failure, mode-selection, seek/Stop and account regressions remain intact. No additional worker, PCM buffer, dependency or App rebuild is introduced.
