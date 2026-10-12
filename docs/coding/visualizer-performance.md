# Playback visualizer performance

This focused review uses fictional audio levels, lyrics and credentials. It covers the optional Playback canvas, terminal frequency overlay and their lifetimes. It does not measure total application RSS, physical audio latency or a maximum catalogue size. Cover Flow and artwork residency are outside this change.

## Rendering and allocation contracts

The four scene choices and frequency controls form an unframed vertical overlay on the left of the visual stage. Their selected state uses the accent colour; each keeps its accessible label and keyboard operation. Showing or hiding an additional control does not reserve a layout row or change the scene centre.

Dense scenes retain one canvas-local field of 1,200 point objects and 57,600 bytes of precomputed Float64 geometry, plus four band values. Geometry and camera rotation update those points in place; depth sorting does not corrupt the following frame. A floating-only mount never creates this field. This trades a small bounded retained working set for removal of the previous 2,400 new point objects per dense draw. It is not a lower-RSS claim.

Canvas dimensions and the accent colour refresh on resize, visibility return and preference events. A draw no longer reads computed styles or CSS dimensions. Hidden views do not draw or read their surface on these events. Paused scenes retain their pose, and unmount cancels the frame callback and removes listeners/observers. The existing 30 Hz draw ceiling, pixel-ratio cap, scene geometry and audio envelopes remain.

The terminal overlay retains all 24 band containers and 240 segments through indexed updates. Its values still come from the original consumed-time peak-hold/decay policy; only DOM ownership changes. Floating lyric cue fitting already coalesces layout work and protects late font-ready callbacks after disposal; no new lyric scheduler or typography change is introduced.

## Scoped measurements

An alternating Node 26 geometry probe uses twelve batches of 250 dense frames. Median geometry/camera/depth-sort work changes from 0.307 to 0.189 ms for the sphere, 0.278 to 0.177 ms for waves and 0.281 to 0.182 ms for relief. Across 120 frames, distinct geometry output objects change from 144,000 to the same 1,200 objects; camera rotation no longer creates a second point array. Unit comparisons retain exact old-equation output across 18 complete 1,200-point frames and several camera matrices, including after depth sorting.

A compiled browser fixture mounts the real components without accounts, provider requests or native audio. Over 100 terminal clock updates, retained segment identities change from 0/240 to 240/240; parent additions/removals change from 2,376 each to zero. With both energy and clock updates, the previous 4,800 parent additions/removals each also become zero. Median update admission changes from 0.6 to 0.1 ms for clock-only updates and 0.8 to 0.3 ms for energy updates. Fifteen supplied frames retain identical lit/peak classes across all 240 segments.

During settled dense/floating draws, the former per-draw style read and two canvas-dimension reads become zero. Draw medians in this short browser sample change from 0.7/0.9/0.8/0.2 ms to 0.6/0.7/0.6/0.2 ms for sphere/waves/relief/floating. Paused and unmounted sampling records no new draws. Timings remain host-dependent, include canvas work and are not a production FPS guarantee or memory benchmark.

The same browser fixture verifies a resize/theme refresh at 850 CSS pixels and a return at 900 CSS pixels (2× backing width 1,700 then 1,800), with the expected accent. Simulated hidden-state resize and ten preference notifications perform zero draws/style/dimension reads, then visibility return restores the actual dimensions. This exercises the component admission guard; native host visibility acceptance remains separate.

## Shadow-free foreground follow-up (2026-10-12)

Floating words now render once, without the duplicate blurred decorative layer or text shadows. Grouping, foreground depth, entry and drift are retained. The real component story verifies nonempty groups and computed shadow absence; this change makes no new RSS/FPS or native foreground-animation claim.
