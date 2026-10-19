# Audio continuity and Cover Flow performance review

This checkpoint reviews the DSP engine and Phémios native PCM/output and artwork lifetimes on the development macOS host on 2026-10-12. It introduces no dependency, changes no source audio/tag or signal algorithm, and does not establish physical output, other-platform deadlines or whole-app memory/FPS guarantees.

## Audio scope

Aède's `docs/coding/dsp-review.md` records exact integrated-meter reuse across format changes and a fused gain/tone/output-guard loop. Retained PCM meter windows no longer accumulate for each format section; the exact integrated-energy history still grows with programme duration. The synthetic 200-section high-rate probe measured maximum RSS of 377,159,680 bytes before and 6,995,968 afterwards with identical reported loudness. Successful guarded processing is checked bitwise against the former separate composition; conversion quality and listening policies remain unchanged.

Phémios [native continuity](../design/audio-continuity.md) records the existing half-second ring and the 100 ms scheduling reserve inside it, callback reset accounting, additive starvation diagnostics and nonblocking retirement of an outgoing DSP voice's existing history worker. The mixer keeps at most one current, one incoming and one retiring voice. A delayed history result cannot block current production, but a very short following track may finish before that retirement slot becomes available. Stop, seek and final cleanup still await bounded confirmation. Multi-track queues now retain this continuous output without DSP too; single-track unprocessed and CD routes remain separate. This removes output teardown as a possible artifact source, without proving physical gapless acceptance.

The unchanged 24-band analysis remains in the allocation/lock/network-free callback. Quiet and concurrently loaded release probes are recorded with their wall-time limitations in the continuity document. No spectrum decimation or additional worker is introduced from a synthetic average.

Native acceptance encountered one generic CPAL output failure after a policy change during a release build. Its error kind had been discarded; scoped host logs did not establish the cause or a CPU overload. Independent source review found the inherited treatment of CPAL’s nonfatal automatic reroute notification as fatal. The narrow classification correction preserves that documented active stream and keeps real device/backend failures fatal; this does not retrospectively attribute the observed incident.

## Cover Flow lifetime and navigation

The renderer keeps its fractional animated viewport, position memory, keyboard/drag/range controls, distance opacity and at most twelve artwork nodes. It performs no layout reads or network request in its frame scheduler. A canonical-reference index now resolves selection without scanning the complete result on each move. A memoized order signature prevents metadata-only result replacement from cancelling a transition; actual order/reverse/removal still follows the existing reset/restore policy.

The real SolidJS component was exercised through an isolated browser fixture with 1,000, 10,000 and 50,000 fictional albums. The largest fixture performed an End jump followed by 100 adjacent alternating moves, with no native account, provider, artwork decoding or audio load.

| 50,000-album workload                   |    Before |  After |
| --------------------------------------- | --------: | -----: |
| Canonical-reference reads for End jump  |    50,051 |     51 |
| Canonical-reference reads for 100 moves | 5,005,050 |  5,100 |
| Median move admission                   |    1.2 ms | 0.2 ms |
| 95th-percentile move admission          |    1.5 ms | 0.4 ms |
| Maximum rendered cover nodes            |        12 |     12 |

Admission timings include browser and development-host noise. Median animation-frame interval remained about 8.3 ms; the later run had more scheduling outliers while native compilation was active. These observations establish fewer repeated lookups and lower synthetic admission work, not an FPS increase, production benchmark or maximum supported catalogue size.

A separate mid-transition metadata replacement reproduced a snap to the destination before correction. Afterwards the immediate fractional pose remained identical and advanced on subsequent frames. Three behavioral tests preserve that transition and verify real order/reverse/removal changes and origin-qualified reference selection.

## Acceptance boundaries

Behavioural and build verification, native synthetic acceptance and final counts are recorded in [current state](current-state.md). Tests deliberately hold history confirmation and simulate bounded producer stalls at 8/48/192 kHz; they preserve held PCM and count only consumed source frames. Browser fixtures and audio profiling are temporary/fictional and do not modify the user's library or account.

Decoded-image residency and encoded/disk artwork quotas need separate consideration: keeping few rendered cards is not a bound on the complete WebView image cache. An isolated fixture with 256 repeated fictional 512-pixel PNGs and unique Blob URLs compared image readiness during cold/warm End travel. Removing eager preload produced incomplete visible images on 43 cold frames; retaining preload but releasing its Image on completion still produced 41 cold and 18 warm incomplete frames. Decode medians improved, but readiness regressed against the original retained-image fixture, which recorded zero incomplete frames. Both experimental policies were discarded. These checks observe DOM image completion/decoding, not physical paint, garbage collection or representative catalogue RSS.

This review therefore retains the existing shared stable URLs, eager preload, image references and cache cleanup semantics. There is no new bound on total artwork memory; old disk namespaces also still accumulate. A strict LRU would require visible/transition pinning and sustained fast-scroll acceptance before it could safely replace them.
