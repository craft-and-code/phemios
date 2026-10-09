# Managed Aède and combined catalog

## Authorized scope

Settings replaces the connection button, retains a source-status light and offers local folders plus the existing server connection concurrently. The user chose a combined public catalog with visible Local/Server origins. Personal data and installation operations remain scoped to one actual source/account; matching display names never merge server identities. Settings includes roots/exclusions, explicit scans/fetches, supported account operations, external-service configuration, language preference and three presentation colours with reset. French/English translation follows a separate commit.

## Engine ownership

A target-specific packaged Aède executable owns scanning, accounts, graph persistence and DSP. Native Phémios starts only this executable against its dedicated app-data store, on an OS-assigned loopback port. Readiness uses a versioned structured reply; the parent's retained stdin is a lifetime lease. Only this owned process is stopped. Existing servers and data paths remain independent. The local principal uses an app-owned protected secret rather than exposing credentials in arguments, browser storage or logs. Corrupt settings/credentials are preserved and refused. Closing the app releases the lease and normal Aède shutdown drains its accepted work.

## Source boundary

Two native client/cache/session contexts remain live. Public presentation references are namespaced before crossing IPC; only validated reference fields are rewritten, never notes, paths or tags. Reference-bearing calls select their originating source; mutations cannot mix origins. Non-entity personal and diagnostic views explicitly select a source, and artwork caches remain per source. Album/discography playback remains on its original source; user labels never route audio.

## Watched folders and unavailable media

Folder selection uses the native directory picker or an explicit native path. Network shares are selected through their OS-mounted folder/UNC path. Registration is independent of scanning. A disconnected root remains configured and retains cached catalog entries; an unavailable or unmounted folder is not an empty library. Source root operations reuse Aède's roots/exclusion contracts and writer locking. Native preflight and engine retention are covered separately, including mount points that remain as empty directories. Mount/share credentials are owned by the OS; Phémios does not write audio tags or mount a missing destination as a new local directory.

## Credentials and presentation

Fanart.tv and AcoustID keys stay in private native configuration and enter only the owned engine environment on explicit start/restart. They are never returned as configured values to browser storage. MusicBrainz, Wikipedia, Wikidata and Cover Art Archive do not need a key in the existing Aède profiles. Remote installation credentials cannot be changed through an unsupported API; the UI explains that boundary. Language and validated colour preferences are non-secret app presentation data, with malformed stores preserved rather than silently reset.

## Acceptance

Meaningful tests cover source collisions, reference round trips, unrelated text preservation, mixed-origin refusal, isolated caches/annotations, startup lease termination, private configuration refusal, unavailable/remounted roots and colour/language restoration. Native host acceptance uses isolated fictional local and server catalogs, confirms simultaneous browsing and source-specific annotation/playback, roots lifecycle and shutdown, and never changes the user's existing installation. Minimum toolchain, Windows/Linux builds and physical/network-mount acceptance are reported independently.
