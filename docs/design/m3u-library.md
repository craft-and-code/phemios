# Library M3U files and saved exports

The M3U view separates existing files in the selected Aède library from saved owner-private exports. Its default is **Library files**. It does not infer files from Phémios actions: Aède discovers `.m3u` and `.m3u8` under its watched roots, including playlists created by the CLI and playlists with no adjacent catalogue album. Shared library files are not imported into the private playlist store. The existing personal-library selector distinguishes local and remote sources when both are present.

## Read and identity contracts

Aède advertises `library_m3u_files` for authenticated read-only `GET /api/me/v1/m3u-files` and `GET /api/me/v1/m3u-files/{id}`. List requests use `offset`, `limit` and optional `q`; file-name/path search happens before pagination. The same capability includes full-name search on private M3U summaries. An older server can still expose its private exports without a query; unsupported file browsing asks for an update/restart instead of reporting an empty folder.

Each file has an opaque `m3u-file-` plus 64 hexadecimal selector, a display name, original filename and canonical path. The selector is not authorization: every read rechecks currently permitted roots and the authenticated principal. Children that are symlinks are not followed; exclusions apply and overlapping roots are deduplicated. Aède always excludes its private `data_dir/playlists` subtree from shared file discovery and detail reads, including when a watched root encompasses that data folder. Each owner retains its exports through the separate private routes. Inaccessible roots/directories remain visible as counts rather than a claim of complete empty results. Native IPC admits only the exact list route and bounded read IDs; no arbitrary path or write route is added.

Listing reads metadata only and deliberately returns `track_count:null`. Only selecting a file reads its text and returns a confirmed entry count. Discovery has file, directory-entry, depth and cooperative elapsed limits; a capacity failure is explicit rather than a truncated total. A blocked operating-system read on a network mount is not interruptible by that cooperative deadline. A selected file is bounded to 8 MiB UTF-8 and 4,096 entries; JSON replies retain the native 16 MiB ceiling. Non-UTF-8 or oversized files remain listed but have a useful read error. The view never opens or plays paths/URLs declared in the text.

## Preview, downloads and recovery

The file list and selected content have separate height-bounded scroll areas, with keyboard focus and independent right-side scrollbars. The category/search toolbar and pagination remain outside those areas. Narrow windows stack the panes without giving an unbounded list control of the page height. Page/category/query updates are batched before admitting the next read.

Simple path-only and extended files, a UTF-8 BOM and CRLF are supported. Extended titles are associated with their next entry; an unnamed entry uses its last path component. The original text is retained for exact download, including BOM and line endings. Native publication derives a confined opaque basename and a fixed `.m3u`/`.m3u8` extension, creates private files without overwriting previous downloads, and ignores a server-supplied destination path.

File and export reads resolve failures inside the view, keeping Refresh/Retry and navigation available. Results, selected content and download acknowledgements belong to the exact session, source, category, query, page and file. Changing owner immediately hides retained personal content; unmount prevents further request admission. Explicit Refresh checks capabilities again, so updating the same server does not require a logout. Query changes are coalesced for 250 ms before enumerating folders.

## Verification scope

Tests exercise exact simple/BOM/CRLF content, target/count/page validation, confined downloads, narrow read-only routes, recovery after read failure, same-server capability updates, late owner/source replies and disposal. Fixtures use fictional names and owned temporary folders. Provider availability, network mount behavior, other-platform filesystem permissions and native range-event ordering are separate acceptance.

Explicit native downloads now use the operating system Downloads directory directly. Names remain native-selected and create-only; existing files and exact M3U bytes are retained. Shared DownloadButton shows a confirmed green check for three seconds, resets on another selected file/account and keeps scoped failure feedback beside the preview path. See [the client follow-up](client-followup.md).
