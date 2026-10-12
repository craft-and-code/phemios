# Radio tuning interactions

The dial indexes the current Radio Browser result page; its marks do not represent FM frequencies. Directory browsing and stream playback use the existing account-independent radio services. Only saved favourites require an authenticated Aède account.

## Preview and commit

A pointer gesture or held range key previews each selected station immediately. While radio is already playing or connecting, releasing the pointer/key commits exactly the final station to the existing playback controller. It does not resolve intermediate stations or repeatedly restart their streams. Clicking a station row applies the same rule immediately. Selecting a station while idle, paused or failed remains silent until explicit Play. Search completion, page mounting and retained favourites never initiate playback.

Pointer cancellation, a replaced result page, pause/stop, a later transport selection and view disposal discard the preceding gesture. A native change event after completion/cancellation cannot rearm that gesture. An accessibility input/change pair commits without requiring pointer or keyboard events. Selecting the currently engaged station does not restart it. The existing transport still owns stream UUID validation, startup deadlines, errors and volume; tuning introduces no additional provider or IPC contract.

## Local tuning feedback

A primary pointer drag plays one of three original synthesized textures: radio static, a wandering whistle or fluttering interference. A loop is chosen randomly once, after more than four horizontal pixels of movement; clicks, keyboard selection and stationary gestures produce no feedback. Pointerdown prepares Web Audio silently to preserve WebKit user activation. The texture remains unchanged throughout that gesture and never resolves, pauses, resumes or restarts the current station. A failed or late context resume cannot start an abandoned gesture or turn a radio stream failure into a tuning action.

Release, cancellation, focus loss, hidden documents, directory replacement and page disposal stop the feedback with a 40 ms release envelope. A page owns one lazy AudioContext, at most one active and one retiring voice, and at most three cached mono buffers of 16,000 float samples each (192,000 sample bytes in total). Bursts of gestures retire the oldest release voice before admitting another. Sources disconnect on completion or bounded wall-clock cleanup. After a stationary click or the last release voice, the unused context is suspended; another gesture resumes the same context, waiting for any preceding suspension. A canceled late resume returns to idle. Disposal releases buffers and closes the context after the short fade. No recording, decoder dependency, provider request or network asset is involved.

The feedback follows the volume of the currently displayed footer transport, including preemptive mute with no playback. A master gain makes mute immediate for both the current and retiring feedback voice. Optional feedback errors are displayed separately from the radio transport; they do not alter playback state. The synthesis uses silent seams and short onset/release ramps. Isolated muted macOS acceptance verifies native WebKit pointer admission and active/idle station switching without feedback errors; physical listening remains unverified.

## Favourite owner identity

The presentation identity combines source, server authority and stable account ID. A username rename retains the same loaded favourites; a recreated same-name account clears the preceding projection before reading its own preferences. The stored `phemios.radio-favourites` key, version-one station schema and server GET/PATCH requests remain unchanged. Source and server identity are never inferred from a station's country or name.

## Verification boundary

Controller tests reproduce the former selection-only dial, exercise coalesced pointer/key gestures, cancellation, transport/page replacement and disposal, and hand only the final choice to the actual radio playback controller with injected fictional media. Account tests verify stable-ID naming and replacement behavior. Feedback regressions verify once-per-drag selection, stationary clicks, pointer identity, delayed resume rejection, gain/mute, bounded voice overlap, buffer reuse and context retirement; the synthesized PCM is finite, distinct and silent at its loop seam. Isolated macOS host acceptance additionally verifies a live directory, idle selection and switching between muted live streams. These checks do not establish physical audio or keyboard/assistive range-event ordering on each platform.
