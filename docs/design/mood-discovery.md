# Mood discovery: feasibility proposal

This is a researched proposal, not an implemented menu or a new dependency. No Tune implementation was consulted for this proposal.

## Reusing retained FlacCompagnon results

The current report offers integrated LUFS, loudness range, momentary/short-term peaks, DR, clipping/true peak, cutoff and stereo/detection evidence. It does not provide BPM, key, beat/danceability, learned musical embeddings or valence/arousal predictions. Existing retained values can support explicit loudness/dynamics filters; unknown or stale results must remain unknown. Loudness is affected by mastering and normalization, so it cannot identify happiness, sadness, instrumental content or genre reliably. DR is not a tempo or energy classifier.

A lightweight first menu could retain owner-defined atmospheres combining existing tags/genres and eventually measured loudness/dynamic ranges. Show which criterion selected a track and allow user correction. Do not label technical thresholds as measured emotional truth. The UI and saved selections are moderate work; dependable automatic semantic classification is a separate engine milestone.

## Candidate analysis engines

[Essentia](https://essentia.upf.edu/models.html) supplies pretrained mood, danceability and valence/arousal models. Its C++/Python extraction and inference integration would require new runtime/model resources; the library uses AGPL/proprietary licensing and MTG model weights use CC BY-NC-SA/proprietary terms ([licensing](https://essentia.upf.edu/licensing_information.html)). Distribution must select suitable exact versions and terms before adoption.

[LAION CLAP](https://github.com/LAION-AI/CLAP) compares audio and text embeddings and is a candidate for queries such as “quiet acoustic music.” It requires decoding/resampling and model inference rather than an existing analysis JSON. Music-capable checkpoints, multilingual prompt behavior, memory/CPU cost, exact weight terms and performance on the real collection need measurement before choosing it. The current project has added neither models nor a Python/inference dependency.

The primary [ISMIR 2018 audio/lyrics mood study](https://arxiv.org/abs/1809.07276) evaluates valence/arousal on 18,000 tracks and reports improved valence prediction when modalities are fused. It supports evaluating uncertainty rather than promising emotion from a few integrity measurements.

## Proposed architecture

Aède should own explicit cancellable batch analysis and cache derived per-track results with model/version, input freshness and uncertainty. Reuse its decoded-audio path and source identities; never write tags or source files. Phémios would present atmosphere cards or an energy/valence map, source/analysis progress, explanations and personal overrides. Saved atmospheres should evaluate current available results, with missing/stale counts visible. Start with a representative labelled control set before scanning the complete collection; verify resource and inference budgets before selecting a product dependency.
