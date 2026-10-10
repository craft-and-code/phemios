# Managed Aède and combined catalog

## Authorized scope

Settings replaces the connection button, retains a source-status light and offers local folders plus the existing server connection concurrently. The user chose a combined public catalog with visible Local/Server origins. Personal data and installation operations remain scoped to one actual source/account; matching display names never merge server identities. Settings includes roots/exclusions, explicit scans/fetches, supported account operations, external-service configuration, language preference and eight presentation colours with reset. French/English translation follows a separate commit.

## Engine ownership

A target-specific packaged Aède executable owns scanning, accounts, graph persistence and DSP. Native Phémios starts only this executable against its dedicated app-data store, on an OS-assigned loopback port. Readiness uses a versioned structured reply; the parent's retained stdin is a lifetime lease. Only this owned process is stopped. Existing servers and data paths remain independent. The local principal uses an app-owned protected secret rather than exposing credentials in arguments, browser storage or logs. Corrupt settings/credentials are preserved and refused. Closing the app releases the lease and normal Aède shutdown drains its accepted work.

## Source boundary

Two native client/cache/session contexts remain live. Public presentation references are namespaced before crossing IPC; only validated reference fields are rewritten, never notes, paths or tags. Reference-bearing calls select their originating source; mutations cannot mix origins. Non-entity personal and diagnostic views explicitly select a source, and artwork caches remain per source. Album/discography playback remains on its original source; user labels never route audio.

## Watched folders and unavailable media

Folder selection uses the native directory picker or an explicit native path. Network shares are selected through their OS-mounted folder/UNC path. Registration is independent of scanning. A disconnected root remains configured and retains cached catalog entries; an unavailable or unmounted folder is not an empty library. Source root operations reuse Aède's roots/exclusion contracts and writer locking. Native preflight and engine retention are covered separately, including mount points that remain as empty directories. Mount/share credentials are owned by the OS; Phémios does not write audio tags or mount a missing destination as a new local directory.

## Credentials and presentation

Fanart.tv and AcoustID keys stay in one private native configuration. Explicit enrichment attaches them only to the supported per-job service-key contract, for both selected libraries by default. Updates/removal apply to the next job without restarting the local engine. The owned engine does not retain these keys in its startup environment. They are never returned as configured values to browser storage. MusicBrainz, Wikipedia, Wikidata and Cover Art Archive do not need a key in the existing Aède profiles. Server installation keys remain unchanged; absent app-owned keys retain the server defaults. An older server is refused before transmitting any shared keys, with an explicit update/restart explanation. HTTPS still exposes no administrative fetch routes; the UI explains that boundary. Language and validated colour preferences are non-secret app presentation data, with malformed stores preserved rather than silently reset.

## Acceptance

Meaningful tests cover source collisions, reference round trips, unrelated text preservation, mixed-origin refusal, isolated caches/annotations, startup lease termination, private configuration refusal, unavailable/remounted roots and colour/language restoration. Native host acceptance uses isolated fictional local and server catalogs, confirms simultaneous browsing and source-specific annotation/playback, roots lifecycle and shutdown, and never changes the user's existing installation. Minimum toolchain, Windows/Linux builds and physical/network-mount acceptance are reported independently.

## Source presentation refinements

The retained public catalog determines whether origin labels are useful. One origin hides redundant labels and follows its active session automatically; two origins display source badges on cover cards, detail headings and track rows. Track browsing has one bounded concatenated Local/Server window, per-source epoch validation, cached pages and explicit partial failures, rather than a source switch or an unbounded full-track download. Namespaced identities remain distinct. Accounts and personal views keep their owner boundary.

Settings uses a compact vertical category rail, changing to horizontal keyboard-accessible tabs on narrow windows. External keys/options are shared; eligible library checkboxes select independent explicit jobs, both enabled initially. Results report each accepted job or failure separately so a partial success is never described as an atomic transaction. Delete icons remove only the app-owned key and preserve the other key and any input draft. Album/track detail Play resumes a matching paused selection without replacing its queue; a different selection or radio starts the requested item explicitly.

## Settings persistence

Language and colours save immediately, with visible errors and Reset. Scan depth/worker count, enrichment categories and selected library exclusions now persist as validated non-secret app preferences, together with the track page size. Sections merge their changes rather than overwriting each other. Malformed stores are preserved and refused; failed writes leave the last confirmed choice selected. Changing these options never starts a scan or enrichment job. Connection and API-key drafts retain their explicit save actions; roots and account operations persist through their existing native/server contracts. Passwords and bearer tokens are not browser preferences.

### Configurable shell

Appearance contains eight independently retained colours and a Reset preserving language. Legacy three-colour preferences retain their former text contrast. Navigation contains visibility checkboxes (all enabled initially), native drag handles, equivalent move arrows and Reset. Changes publish only after device-local persistence; new menus append visibly to a previously saved order. The top-level Settings gear remains reachable even with every sidebar menu hidden. These controls change presentation, never account privileges or server configuration.

Podcast removal presents an inline confirmation for the captured feed. Choosing another feed or Cancel abandons the request; only confirmation writes the subscription store, with a failed write leaving it intact.

Discogs label biographies are an optional persisted enrichment category. Enabling the category does not contact Discogs; explicit enrichment requests label identification then the identifier-linked fallback. No Discogs token is collected for ID lookups. Each source must advertise fetch_discogs before receiving the new flag; rejected legacy jobs explain update/restart. The original server installation keys remain independent.

## Account settings and portable themes

Settings separates Language from Colours/themes. Eight colours preview immediately; Save exports a versioned JSON theme through the native file picker, and Import validates the complete bounded document before applying it. Theme files include colours/name only, never language, sources or credentials. Reset affects colours only. The native import has a 4096-byte read bound. Saved Settings show device/account confirmation or a visible synchronization failure.

The account-preferences capability loads and patches only validated non-secret appearance, menu, tool, duration-display and scene choices. Writes serialize per captured identity/source and merge independent keys; replaced identities discard late responses and queued changes. Corrupt device/account stores remain explicit and preserved. Device-only use remains supported; older servers show an update/restart explanation and retain local saving. Installation roots/accounts/keys keep their existing native/server persistence rather than being copied into account preferences.
