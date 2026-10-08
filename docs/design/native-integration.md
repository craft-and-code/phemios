# Native Aède integration

## Boundary

Aède owns catalog references, account authorization, annotations, query grammar, playlist ordering, media jobs and file/path rules. Phémios has a framework-independent HTTP/cache client and narrow versioned Tauri commands; all frontend IPC lives in `src/platform/desktop.ts`. Authentication returns public account metadata only. The password is discarded; the bearer token is process-only. Explicit local loopback HTTP or remote HTTPS is accepted, never redirects, URL credentials or arbitrary request authorities.

The client bounds request JSON (16 KiB), each JSON response (16 MiB), total cached public catalog (100 MiB), artwork (32 MiB) and request time (30 seconds). Complete presentation pagination validates totals/offsets/progress and requires one scan epoch. Snapshot DTO validation preserves unknown origin/year, compilations without a principal artist, contributor references and biography attribution. Missing projected services are errors, never fabricated demo data.

## Additive server contracts

- `GET /api/v1/presentation/artists` and `/albums`: paged public presentation fields, all raw tag fields/values for local search, sourced origin/biography, available artist media, release credits and local collaboration neighbours.
- `GET /api/v1/artwork?ref=...&kind=cover|portrait|banner|background|spectrum`: confined entity-owned binary images, bounded rendering, ordinary bearer authorization. No arbitrary filesystem path or external enrichment URL. A missing/symlink/oversize file is not advertised as available.
- Existing `/api/v1/album`, `/track`: track references, file analyses with provenance, and additive `spectrum_available` on track details.
- `GET /api/me/v1/annotations`: paged current-owner annotations. Existing singular annotation/collection and paged collection/history endpoints remain authoritative.
- `POST /api/me/v1/m3u`: save an album's ordered tracks as a private static playlist and an atomic server file. `GET` lists summaries; `GET /{id}` provides owner-scoped download content. M3U uses server paths and does not assume a remote client has those paths.
- `POST /api/admin/v1/analyze` or `/spectrum`: catalog release reference, explicit force option, bounded threads. Aède resolves the release folder and uses its cancellable job manager; no user-supplied arbitrary path. Existing task status/cancel endpoints supply bounded output. Requires a local administrator.

See Aède's bilingual server presentation documentation for exact responses and limits. Native bridge version 1 is unchanged because these commands are additive.

## Artwork lifecycle and responsive navigation

Catalog and image cache paths are application-owned, never supplied by the webview. Image keys include server, account, catalog scan version, entity and media kind. Atomic writes and bounded reads distinguish missing data from corruption. Public cache never includes credentials or private annotations. Corrupt catalog data is preserved; explicit synchronization can replace disposable cache data.

After owner annotations load, one worker warms available covers, portraits, banners and backgrounds. One inspection slot remains available for navigation. Transient HTTP 429/503 read admission is retried at most four times with bounded exponential waits (150, 300, 600, 1200 ms); permanent errors and mutations are not retried. A visible failure count distinguishes attempts from successful loads. Resident blob URLs are shared by all views; card mount, density changes and scrolling do not request covers. Reloading the native app reads the disk cache without authenticating. New scan epochs invalidate old image namespaces; repeated synchronization of an unchanged catalog reuses images. Existing-media replacement requires a rescan. Old namespaces currently accumulate: quota/pruning and bounded decoded-memory working sets remain acceptance work. Missing media has a stable square and an explicit reason rather than an invented cover.

Search normalizes supplied metadata and current-owner values, with immutable weak indexes connecting principal and credited artists to releases. Albumless artists have an explicit unknown-year policy. A 10,000-artist fictional behavior test validates associations; it is not a rendered-scroll benchmark or proof that every cold cover can appear instantaneously.

## Personal actions and analysis

Album annotation drafts are saved explicitly. Save errors retain the draft; account changes clear the in-memory annotation map. The server owns privacy and roles. Favourites include annotated artists/albums. Collections create or replace validated smart-query rules; this page does not yet evaluate collection membership or build arbitrary manual collections. History displays only server-confirmed records, with unavailable track diagnostics.

M3U generation stores on Aède before enabling download. Native download fetches the current-owner playlist again and writes exact server content under the OS Downloads directory, in `Phémios/`. IDs/content are validated; a client filename/path is never trusted, and repeated downloads choose a new filename instead of replacing existing bytes. No general filesystem plugin is exposed. Explicitly started media tasks are retained across page navigation, scoped to the chosen release, polled while connected and cancellable. Opening an album only reads already available results. Completed tasks refresh track details; a spectrum image is loaded on explicit display. Analysis/spectrum jobs may publish sidecars beside the chosen album: acceptance uses an isolated audio copy, never the user's original library.

The discovery graph displays at most 16 local collaboration neighbours, ordered by shared-track weight. Keyboard and list alternatives remain available. Collaboration is not band membership; this first contract does not expose dated external membership or its roles. No external query runs from discovery navigation.

## Module boundaries and limits

`core/src/network.rs` retains one cohesive bounded authenticated client (~325 lines); transport, authority validation and allowlist belong to that boundary. `src/library/context.tsx` keeps the shared session/catalog/annotation/media lifecycle (~261 lines). `App.tsx` holds route/filter composition (~268 lines). `PersonalPage.tsx` keeps current-owner paged views and explicit mutations (~294 lines). These are modest exceptions to the usual 250-line guideline, with separate policy/test modules; split them when independently evolving services justify it.

Native PCM/output control, volume, playback history submission, synchronized lyrics, consumed-signal visualization and mounted-device conversion/verification/copy are not connected by this milestone. Their disabled controls are intentional. Catalog event synchronization, minimum Rust/other-platform builds, cache quotas, virtualization and sustained fast-scroll measurements remain pending. Native visual acceptance now includes authenticated real-library synchronization and binary-image IPC. Final cache, album and download checks are recorded in the acceptance log.
