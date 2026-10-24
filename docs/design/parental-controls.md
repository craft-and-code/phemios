# Account parental controls

## Scope and authority

Settings → Parental controls lets an authenticated administrator configure a non-administrator account on the selected Aède source. The setting belongs to the target's immutable account ID, not its display name, the current desktop user or a child-editable preference document. Local and remote Aède accounts are independent authorities: a rule saved to Local does not restrict a similarly named account on Server. Source-qualified presentation references are resolved to the selected authority's bare artist references before saving.

The catalogue remains shared. Aède produces a restricted projection for a supervised account without deleting artists, changing source files or modifying another owner's annotations, collections, history, preferences or trophies. Administrators cannot enable a policy on an administrator account. Disabled policies retain their configuration without enforcing it.

Guest listening remains unrestricted by explicit product choice. These controls govern authenticated use of the application and server; they are not an operating-system lock, file encryption or a mechanism for preventing playback in another application. Switching to an unrestricted account or using a file outside this account boundary remains outside their scope. The UI must not imply a device-wide child lock.

## Administration and schema

Policy editing is available to current named administrator sessions over HTTPS or local HTTP. Aède refuses legacy installation tokens over HTTPS. Enabling a policy claims an exclusive lock for the administrator’s stable identity. Other administrators may read but cannot change the rules or the protected account’s login, role, enabled state, password or sessions. Only the supervising administrator may disable the rules to release that lock. Other administrators also cannot alter that supervisor’s account or reset its password while it owns locks, preventing impersonation. An administrator with active locks cannot be disabled or demoted until it releases them. Old unclaimed policies can be claimed by the first named administrator who saves them. This is an API/account boundary: a trusted local installation operator can still modify files or restore protected backups outside this interface.

- `GET /api/admin/v1/accounts/:username/parental` returns `{ owner, revision, locked_by, policy }`.
- `PUT` on that route accepts `{ expected_owner, expected_revision, policy }` and returns the new snapshot. The immutable expected owner prevents deleting/recreating the same username from redirecting an older editor to a different account. A stale revision is a conflict; the UI preserves the draft and requires an explicit reload instead of retrying a write automatically.
- `GET /api/me/v1/parental` returns the authenticated owner's policy, revision and current listening status. The response owner must equal the captured session's stable account ID.

A policy contains:

| Field                | Meaning and bounds                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`            | Explicit enforcement switch.                                                                                                                                         |
| `timezone`           | Valid IANA timezone, at most 128 UTF-8 bytes; the server validates it with Jiff.                                                                                     |
| `blocked_artists`    | At most 256 bare `artist:` references, each at most 16,384 UTF-8 bytes; no `@phemios/` source prefix or control characters.                                          |
| `radio_allowed`      | Allows or refuses independent radio listening.                                                                                                                       |
| `podcasts_allowed`   | Global podcast access; false refuses every feed, true applies the address blacklist. Missing fields in old policies retain true.                                     |
| `blocked_podcasts`   | At most 128 canonical HTTP(S) RSS addresses, each at most 2,048 UTF-8 bytes, without credentials. These are subscription addresses, not episode enclosure addresses. |
| `days`               | Exactly seven daily policies, Monday at index 0 and Sunday at index 6.                                                                                               |
| `week_limit_seconds` | `null` for unlimited, integer 0 for no listening, or an integer through 604,800 seconds.                                                                             |

Each day has `windows: [{ start_minute, end_minute }]` and `limit_seconds`. A window includes its start and excludes its end, using minutes after midnight in the range 0–1,440. At most eight non-overlapping windows are accepted per day; no windows means a closed day. Split an overnight period across its two days. The daily limit is `null` for unlimited, 0 for no listening, or an integer through 86,400 seconds. The editor displays minute budgets; persisted values remain seconds. Blank budget input means unlimited, not zero.

Aède canonicalizes and deduplicates saved references/addresses and orders daily windows. RSS identities are inert policy data: adding one does not fetch it. Server canonicalization owns host, default-port, path, percent-encoding and fragment equivalence; publisher requests continue through the separate public-media transport policy. The frontend validates byte budgets and prepares a canonical URL without treating itself as the final policy authority.

Civil dates, weekday windows, daylight-saving transitions and Monday-to-Monday weeks are evaluated by Aède in the saved timezone. A client clock or language change cannot change the server's quota. Status includes `day_used_seconds`, `week_used_seconds`, `remaining_seconds`, `allowed`, `reason` and `next_change_at`. Reserved audio makes displayed usage conservative while a short lease is open. Settlement refunds only unused future time; elapsed time under an active grant remains charged, including short startup or network delays. Refusal codes are `outside_schedule`, `daily_limit`, `weekly_limit`, `radio_blocked`, `podcast_blocked`, `artist_blocked` and `policy_unavailable`.

## Catalogue and cache admission

Aède owns artist hiding and credit propagation. A blocked principal artist removes its albums; blocked credited artists also remove the affected audio and its other placements, including compilation appearances. The public source graph and stable identities remain intact. Search, detail reads and playback must use the admitted projection rather than hiding only visible cards.

Phémios binds every status, snapshot and pending operation to the exact native source/session. A supervised snapshot carries its account ID, full policy, revision and enabled marker. Admission compares all of them, including a canonical full-policy stamp: restoring an Aède backup can change a policy without a higher revision. An ordinary cached catalogue cannot be substituted for a missing or refused supervised projection.

Cover, portrait, banner and background bytes are shared between accounts for the same authority, catalogue version, entity and artwork kind. Old account-partitioned files are reused lazily and promoted to this common cache; private annotations never participate in it. Cache presence does not grant access: the native layer admits the current reference before and after IO through the supervised projection.

Restricted catalogues are kept only in process memory. They are not written over the reusable public disk cache. Public snapshots contain no parental-policy metadata, even when a saved policy is disabled. Loading an older public cache removes that metadata atomically without changing its catalogue timestamp; a restricted snapshot found on disk is refused. Retained artwork is admitted through the current projection; knowing a reference is not enough to retrieve a masked image. Artwork-only policy checks reuse one confirmed response for strictly less than one monotonic second, shared only by clones of the same native session. Expired responses are discarded before a fresh read, and errors are not cached. This avoids one HTTPS round trip per resident cover; snapshot admission, HQPlayer, episode export and audio leases keep their fresh checks. A changed policy can leave an already-cached asset admitted for at most that short interval. Session changes, failed status admission or policy changes hide obsolete results. A stable policy scope remounts detail resources and invalidates retained search results; five-second counter updates alone do not remount catalogues or trigger full graph merges.

Status polling uses a five-second delay after each completed request. Same-source concurrent reads share one pending request. Missing or malformed status from a source that advertises parental support fails closed until a valid response returns. Error recovery re-admits a fresh source projection even when its revision is unchanged. Legacy servers without the parental account marker retain their existing behavior; Phémios does not present them as protected servers. Named administrator and legacy exemptions for external media require a live authenticated session with the same enabled identity and role. A refused, malformed or changed live identity fails closed without altering public offline catalogue/artwork cache admission. Genuine legacy capability absence does not invent a disabled policy; if support appears, the live policy is checked. Named external-media ownership is retained even without a lease, and polling can retire that exact radio/podcast transport after authority becomes unavailable. Anonymous guest use has no named-session request.

## Audio admission and listening budgets

Catalogue audio is admitted by Aède and by the native transport using the exact connected account. Radio and podcasts keep their independent WebView transports and never receive Aède credentials. Before starting or resuming either, the client checks that account's current media authorization and reserves a short server-owned listening lease when supervision is enabled. The captured authority remains attached to that media even if the user changes the currently selected source in the interface. Anonymous radio also retains its originating source without a named owner, policy request or lease. A later failure on another source cannot retire it; a login replacing its actual anonymous source does retire that captured lifetime. Radio captures the exact initiating source/login synchronously before output handoff, gain hydration or directory resolution; capture alone reserves no listening time. Final admission still checks that captured lifetime immediately before play. A changed dropdown does not adopt a successor owner, and a replaced/disconnected initiating login refuses the pending start.

`POST /api/me/v1/parental/lease` supports three explicit actions:

```json
{ "action": "reserve", "media": { "kind": "radio" }, "seconds": 10 }
{ "action": "renew", "lease_id": "opaque", "consumed_ms": 4200, "seconds": 10 }
{ "action": "release", "lease_id": "opaque", "consumed_ms": 1200 }
```

The external endpoint accepts `{ kind: "radio" }` or `{ kind: "podcast", feed: "https://…" }`. Music leases are reserved internally by Aède’s PCM transport; the external endpoint refuses them. Reserve/renew returns `{ lease_id, granted_seconds, expires_at, server_now_ms }`; release returns no document. Grants are bounded to ten seconds and may be shorter at a quota or schedule boundary. `consumed_ms` measures only actual playing time in the current grant slice, is monotone within that slice and cannot exceed the grant. A successful renewal starts a new slice; late release after an in-flight renewal reports only its unreported delta.

An independent monotonic deadline stops external audio even if a renewal request hangs. Its budget is the smaller of the grant duration and the server's `expires_at * 1000 - server_now_ms`, measured conservatively from the beginning of the client request. Client wall-clock skew cannot extend or revoke the lease, and a valid final one-second grant is usable. Renewals run no later than eight seconds into a grant and earlier for short grants. The client does not report paused or buffering media as playing time. The server conservatively retains elapsed time already covered by an active reservation; releasing a paused transport refunds only the future part. Pause/Stop, account replacement and disposal release the held lease; a late result cannot restart stopped media or publish into a replacement account.

The account status and visible reason explain refused starts and the remaining budget. Seeking does not invent a new history event or count the skipped duration as listening. Server reservations and settled intervals protect the same owner's budget across media categories and concurrent admitted transports. Network or storage failures are explicit; the client does not fall back to ungoverned audio for a supervised account.

HQPlayer starts are unavailable for a supervised account because Phémios cannot enforce the native PCM deadline inside that external player. If a policy becomes active during an existing HQPlayer session, the UI stops it when the next valid status observes the change. The normal polling cadence is five seconds after a completed request; this is not a guarantee of remote device silence within five seconds under blocked IO, a suspended client or an unresponsive external player.

## Radio, podcasts and downloads

A refused radio policy hides Radio from navigation and guards direct access/start. Unrestricted guest/admin radio retains the existing provider-independent behavior. The catalogue's selected source does not silently reassign an already admitted radio stream's authority.

A global podcast refusal hides the Podcasts menu, guards direct navigation and refuses start/resume. Otherwise blocked podcast RSS identities are filtered from subscriptions and checked again before episode start/resume. Private retained subscriptions and listened evidence remain stored for their owner; hiding a feed does not destroy those records. Matching uses the original subscription feed, never a redirect or a media enclosure chosen by a publisher.

Standalone episode downloads are disabled for supervised accounts, including in native admission, because an exported file can be played outside controlled transport. This cannot revoke files already exported before a policy was enabled. Ordinary account-private document backup remains distinct from playable media export.

## Storage and verification boundaries

Policies and listening accounting are protected Aède account data. They are not part of Phémios's child-editable presentation preferences, theme files or portable preference import/export. Aède's protected backup contract handles its own policy/accounting data. Changing a menu, shortcut, language or cover-size preference cannot modify a policy. Ordinary personal-account records and their existing preservation rules remain unchanged; see [account isolation](../coding/account-isolation.md).

Pure policy parsing, exact owner/revision administration, artist selection and schedule editing have isolated tests and Storybook states. Access tests cover concurrent reads, replaced sessions, malformed status, recovery, restored same-revision policies and stable rendering under usage-only polling. External-media tests cover late grants, short/expired grants, skewed client clocks, hung renewals and per-slice consumption. Native and backend checks remain necessary to verify their separate enforcement boundaries. UI/browser verification does not establish physical audio timing, actual HQPlayer behavior, hostile OS isolation or other-platform acceptance.

Relevant implementations are `src/library/parental-controls.ts`, `parental-admin.ts`, `parental-access.ts` and `parental-media.ts`, `src/views/SettingsParental.tsx`, the narrow native policies in `core/src/network_parental.rs`, and Aède's `aede-core::parental` module. See [local engine and settings](local-engine.md), [radio transport](radio-tuner.md) and [podcasts](podcasts.md) for the underlying account and media contracts.
