# Mood discovery

The first explainable tag/genre menu is implemented; automatic musical-emotion inference remains a researched proposal. No Tune implementation was consulted. No model or external product dependency was added.

## Reusing retained FlacCompagnon results

The current report offers integrated LUFS, loudness range, momentary/short-term peaks, DR, clipping/true peak, cutoff and stereo/detection evidence. It does not provide BPM, key, beat/danceability, learned musical embeddings or valence/arousal predictions. Existing retained values can support explicit loudness/dynamics filters; unknown or stale results must remain unknown. Loudness is affected by mastering and normalization, so it cannot identify happiness, sadness, instrumental content or genre reliably. DR is not a tempo or energy classifier.

A lightweight first menu could retain owner-defined atmospheres combining existing tags/genres and eventually measured loudness/dynamic ranges. Show which criterion selected a track and allow user correction. Do not label technical thresholds as measured emotional truth. The UI and saved selections are moderate work; dependable automatic semantic classification is a separate engine milestone.

## Candidate analysis engines

[Essentia](https://essentia.upf.edu/models.html) supplies pretrained mood, danceability and valence/arousal models. Its C++/Python extraction and inference integration would require new runtime/model resources; the library uses AGPL/proprietary licensing and MTG model weights use CC BY-NC-SA/proprietary terms ([licensing](https://essentia.upf.edu/licensing_information.html)). Distribution must select suitable exact versions and terms before adoption.

[LAION CLAP](https://github.com/LAION-AI/CLAP) compares audio and text embeddings and is a candidate for queries such as “quiet acoustic music.” It requires decoding/resampling and model inference rather than an existing analysis JSON. Music-capable checkpoints, multilingual prompt behavior, memory/CPU cost, exact weight terms and performance on the real collection need measurement before choosing it. The current project has added neither models nor a Python/inference dependency.

The primary [ISMIR 2018 audio/lyrics mood study](https://arxiv.org/abs/1809.07276) evaluates valence/arousal on 18,000 tracks and reports improved valence prediction when modalities are fused. It supports evaluating uncertainty rather than promising emotion from a few integrity measurements.

## Proposed architecture

Aède should own explicit cancellable batch analysis and cache derived per-track results with model/version, input freshness and uncertainty. Reuse its decoded-audio path and source identities; never write tags or source files. Phémios would present atmosphere cards or an energy/valence map, source/analysis progress, explanations and personal overrides. Saved atmospheres should evaluate current available results, with missing/stale counts visible. Start with a representative labelled control set before scanning the complete collection; verify resource and inference budgets before selecting a product dependency.

## Implemented first profile

The Ambiances sidebar menu is configurable through Settings Navigation. Aède's dependency-free `aede-moods` crate owns exact normalized tag/genre rules. Five transparent starter recipes can be edited; users can add their own name/criteria. The authenticated source stores rules per owner; the UI reports matching counts and the tag/genre evidence for each result. Artist tags contribute only the principal discography, not guest performances. Track/album tags and catalog genres contribute directly. Unclassified tracks are not assigned fabricated emotional scores.

Playback gathers the current paged match set (maximum 4096 tracks) and starts its complete chronological queue through the native player. Local/Server account scopes stay explicit where both exist. Account/source changes discard late results. Existing FlacCompagnon integrity/mastering values do not currently choose atmospheres; tempo, learned embeddings and calibrated emotional inference remain separate prospective work described above.

## Bliss review and a refined acoustic profile

The current primary [bliss-audio 0.13 feature documentation](https://docs.rs/bliss-audio/0.13.0/bliss_audio/enum.AnalysisIndex.html) lists tempo, zero-crossing rate, spectral centroid/rolloff/flatness statistics, loudness statistics and chroma summaries. The project's [playlist implementation](https://github.com/Polochon-street/bliss-rs/blob/master/src/playlist.rs) exposes distances between feature vectors and recommends a weighted alternative to plain Euclidean distance. This is useful architectural evidence, rather than a reason to copy its implementation or label similarity as emotion. No source was copied, dependency installed or sound classifier claimed.

Proposed next engine profile: decode through Aède's existing analysis boundary, extract versioned finite per-track descriptors, calibrate each feature on a representative control set, and rank neighbours around several user-labelled exemplar tracks. Keep tempo, timbre and mastering-related components separately weighted; report missing measurements, the contributing features and the input/model version. Existing FlacCompagnon loudness/dynamics can contribute explicitly to that component, but cannot substitute for tempo/chroma/timbre extraction. A small exemplar set per atmosphere, exclusions and personal corrections would refine broad genre recipes without guessing that every metal track is energetic.

Evaluate duplicate recordings, ballads within energetic albums, remasters, sparse/unclassified audio, relative genre bias, time/RAM on target hardware and user-labelled retrieval quality before wiring acoustic ranking into saved rules. Retain the current explainable tag/genre rules while those measurements are unavailable. The cards now omit repeated identical icons; names and match counts identify each atmosphere.

## Specific personal evidence refinement (2026-10-13)

The existing genre-only recipes can put a ballad into Energy merely because an artist was tagged energetic. Aède now indexes the owner's recognized recipe tags once, prioritizes explicit track tags over album tags, then principal-artist tags, and only falls back to exact genres if no layer contains a recognized mood tag. Generic/import tags do not block inheritance. A more specific recognized tag replaces conflicting inherited criteria; explicitly supplying two atmosphere tags at the same level still permits both atmospheres. Custom and overridden recipe vocabularies are respected. Results rank that evidence level before stable chronological ties and pagination. The UI reports the source of its matched tag; this is not a probability or a derived emotional label. Existing untagged genre matches remain proposals.

The reviewed [Bliss playlist source](https://github.com/Polochon-street/bliss-rs/blob/master/src/playlist.rs) provides weighted Mahalanobis/cosine distances and seed-variance weighting: features on which examples agree can receive more weight. These algorithms need versioned musical feature vectors and labelled exemplars, absent from the current technical reports. The implemented personal-tag hierarchy is independent; no Bliss source was copied or package installed. Actual acoustic discovery still requires the extraction/calibration milestone above. FlacCompagnon loudness/DR cannot substitute for tempo, timbre or chroma.
