# Radio tuning interactions

The dial indexes the current Radio Browser result page; its marks do not represent FM frequencies. Directory browsing and stream playback use the existing account-independent radio services. Only saved favourites require an authenticated Aède account.

## Preview and commit

A pointer gesture or held range key previews each selected station immediately. While radio is already playing or connecting, releasing the pointer/key commits exactly the final station to the existing playback controller. It does not resolve intermediate stations or repeatedly restart their streams. Clicking a station row applies the same rule immediately. Selecting a station while idle, paused or failed remains silent until explicit Play. Search completion, page mounting and retained favourites never initiate playback.

Pointer cancellation, a replaced result page, pause/stop, a later transport selection and view disposal discard the preceding gesture. A native change event after completion/cancellation cannot rearm that gesture. An accessibility input/change pair commits without requiring pointer or keyboard events. Selecting the currently engaged station does not restart it. The existing transport still owns stream UUID validation, startup deadlines, errors and volume; tuning introduces no additional provider or IPC contract.

## Favourite owner identity

The presentation identity combines source, server authority and stable account ID. A username rename retains the same loaded favourites; a recreated same-name account clears the preceding projection before reading its own preferences. The stored `phemios.radio-favourites` key, version-one station schema and server GET/PATCH requests remain unchanged. Source and server identity are never inferred from a station's country or name.

## Verification boundary

Controller tests reproduce the former selection-only dial, exercise coalesced pointer/key gestures, cancellation, transport/page replacement and disposal, and hand only the final choice to the actual radio playback controller with injected fictional media. Account tests verify stable-ID naming and replacement behavior. These checks do not establish live provider availability, physical audio or platform-specific native range-event ordering; those require host acceptance.
