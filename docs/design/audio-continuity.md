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
