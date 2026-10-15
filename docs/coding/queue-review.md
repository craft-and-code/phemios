# Queue composition review

The reviewed change set adds a transient shared queue workspace, exact contextual additions, reorder/removal/clear controls, bounded multi-category search and the Albums-only recent filter. The public catalogue and owner-private selections retain their separate admission rules. See [queue composition](../design/queue-composition.md) and [recent filtering](../design/recent-albums-filter.md).

## Confirmed defects corrected before commit

- A private M3U could resolve an ambiguous file path to the first matching placement. A single per-request index now refuses nonunique paths and removes repeated catalogue scans. Shared-file discovery retains root/exclusion/private-export isolation and original entries never cause file I/O.
- A DSP successor removed between selection and source opening could yield an empty reference. Membership and reference retrieval now share one state lock; the producer skips the retired candidate.
- HQPlayer selected while idle could admit an append because admission read the last effective device. Both initial and post-expansion checks now use the selected output, consistently with contextual Add controls.
- Repeated reads of a JSX thumbnail getter mounted three subtrees per row. Solid children resolution now mounts one thumbnail, preserves it through transport changes and disposes replaced/removed artwork.
- Detail routes inherit their originating navigation section. Footer/shortcut queue priority now requires the actual playlist workspace route, so opening a detail from it does not retain that priority.

Every defect has a regression, with the M3U, preload, HQPlayer, artwork-mount and route failures exercised before correction. Existing behavioral suites remain intact.

## Performance and limits

Artist resolution builds one reference index instead of searching all artists for every selected track. Cached artist/principal indexes are built only for the relevant search category. M3U expansion performs one catalogue index pass, then bounded per-occurrence lookup. The queue remains limited to 4096 occurrences and initially renders 100 rows with explicit expansion. Cached thumbnail rendering performs no network request on scroll. These are algorithmic and lifecycle improvements, not a measured whole-application memory, FPS or physical gapless guarantee.

The complete macOS Phémios gate passes 969 tests: 754 TypeScript, 19 Node tooling, 178 independent Rust core and 18 native bridge tests. Strict formatting/lint, frontend production build, declaration documentation, Storybook build, bridge compatibility, Rustdoc/Clippy and native executable build pass. Browser artwork replacement/removal checks confirm stable mount counts and cleanup. Aède has its own full verification record. Real acoustic continuity, live HQPlayer and Windows/Linux acceptance remain separate.
