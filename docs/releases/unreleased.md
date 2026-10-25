# Phémios — Next release draft

This reviewed change list is the preparation source for the next version-specific release notes. No version number, publication date or release authorization is implied. Before tagging, copy these changes into `vVERSION.md`, add the exact platform download/checksum links, and clear this draft only after carrying the entries forward. The release workflow appends the complete Git commit history automatically.

## Added

- Make biography links visible and link known catalogue genres and retained track titles in artist/label summaries and full readers. Open a unique track directly; offer the retained album editions when a title has several placements. Link biography years to all owned albums of that year, only when such albums exist, clearing stale browse filters. No background enrichment or text changes.

- Show cached label logos beside names in Labels and in label headers, preserving their proportions. Use an accessible fallback icon when unavailable, including older engines. Logos reuse Aède’s explicit Fanart.tv enrichment and the existing offline image cache.

- Preview the first queued track's cover, title and artist in the idle footer after a **+** addition, including individual tracks, without starting playback. Existing playback details stay in place.

- **Collections as custom menus:** choose a saved collection in **Settings → Navigation** and open its albums directly from the sidebar. The collection and every shortcut share the same name: rename from either view, move it anywhere in the menu, hide it, or remove the shortcut while retaining the collection. Stable Aède IDs keep renames linked and prevent deleted/recreated names taking over old shortcuts. Collection rules stay in Aède and shortcuts follow the active account/library profile. Search within the collection and return from album/artist detail without losing the originating menu.

- **Shared settings lists:** excluded folders and available collections use a bounded scrollable list with keyboard selection. Exclusion removal with Delete/Backspace or minus selects the preceding row, falling back to the following row when needed, for repeated removals. Drag/drop or Alt+arrow keys rearranges exclusions locally without changing scan behavior.

## Fixed

- Keep label logos inside their reserved frame and display cached transparent PNG logos reliably when opening a label on macOS.

- Respect the App language during general biography enrichment. With the corrected Aède engine, previously cached biographies in another language are reconsidered without forcing unrelated passes; failed retrievals preserve the previous text. Clearly identify a differing biography language in artist and label details.

- Rotate shared refresh arrows clockwise, including Audio CD and network players. Align the Collections visibility/name spacing with the duration/rename spacing, enable cover sizing in Genres compact lists, and remove the duplicate divider above MusicBrainz review.

- Retain selected sort and display controls while navigating during the session, including Labels sorted by album count in reverse order, personal album layouts and Collections order. Keep reverse catalog sorting independent per view; new App sessions start with defaults.

- Center enlarged covers and missing-cover placeholders even when a long title widens the dialog; preserve the Close button size.
- Restore the incomplete-listening corner marker in Compilations across Grid, List and Cover Flow, using confirmed private completion state only.
- Keep Pause available while an accepted catalogue stream is buffering, instead of disabling the footer or attempting another start. Refresh local buffering transitions at the active cadence while retaining serialized commands and HQPlayer polling limits.

- Keep narrowed alphabet/year bands attached to the pointer through diagonal and fast movement outside the rail, including capture loss. Enlarge the grip, apply the final release position, skip unchanged filter updates and clean up on cancellation or window changes.

- Replace the inaccessible Aède server-log instruction with a **View diagnostics** action. The session-only journal retains sanitized failed-operation summaries and clears on account replacement/logout. Unreadable personal data now prompts an engine-version compatibility check without exposing raw server errors or suggesting a reset.

- Keep the Collections result count above expanded albums with a 16px gap before covers, without evaluating collapsed collections.

- Settings lists start dragging only from their dot grips. Exclusion and collection row bodies retain ordinary selection without a drag cursor or accidental row move.

- Complete macOS ad-hoc signing now covers the App, its resources and its embedded Aède executable. Build/release checks reject an invalid seal or a different App inside the DMG before uploads. This is integrity signing; Developer ID and Apple notarization remain separate.

- Remove the duplicate outer FlacCompagnon title so analysis and spectrum frames begin at the same position. Square the colored MD5 border's left corners; spectra retain their framed download control and 16px heading/content gap.
- Empty exclusion-list messages are centered horizontally and vertically.

## Changed

- Simplify label details: remove alphabet/year filters and compact-view switching, retain reverse sorting and collection creation, and always show all owned albums in a grid. New label collections have no hidden date/alphabet restriction.

- Rename the compact album presentation to **Compact list** and unify its icon in Albums, Compilations, Genres and Composers. Place years below titles and center each metadata group beside its cover. Cover hover or keyboard focus reveals proportionally sized Add/Play controls, left/right, replacing trailing row actions; touch controls remain visible.

- Editorial artist rows omit artist-level Play and queue-append buttons and use the recovered space for two or three album previews when the list is wide enough. Hovering or focusing an album cover reveals its own centered Play button. Narrow layouts retain readable artist details and independent album links.
- Place the Collections expansion eye before each collection name, keeping rename and removal controls on the right without evaluating collapsed collections.

- All semantic interface icons now use the same Lucide component library, size, stroke and color conventions. The credits identify Lucide as the shared icon source.
- Navigation places available collections to the right of menus, below them on small screens. Collections can be selected and added, or dragged directly to the desired menu position.
- GitHub release descriptions retain a readable feature/fix summary followed by every commit since the previous stable tag and a full comparison link.

- Collection menus no longer need a separate initial name or permanent Refresh button. Compatible Aède ID support is required; old engines show an explicit update/restart message.
- Navigation headings have no icons or empty icon slots; unnamed spacer rows have no text or icon, and settings lists use the queue-style translucent pointer-following drag preview. Name a spacer to create a custom group heading, or clear its name to restore blank space.
- Add a reverse-order button immediately before Create in Collections, with the shared control gap, reversing the filtered current page without evaluating collapsed collections.

- Refine Navigation spacing, remove drag-grip frames and align spacer removal beside the movement arrows. Reduce Stop glyphs consistently while preserving button hit areas.
- Pinned collections now use the same album catalog and header as Albums, with filter rails, reverse order, recent additions and explicit list/grid/Cover Flow presentations. Cover sizing is enabled in album List and Grid modes, including Albums and Compilations; narrow list rows limit artwork width to preserve readable titles and actions. Searches and filters stay inside each collection, and the loader is centered in the content area.
- Remove the unnecessary reset icon in keyboard-shortcut preferences.
- Albums, collection menus and Composers have a Grid action between List and Cover Flow. Compilations gains Cover Flow and keeps Grid by default; each view remembers its presentation during the session.
- Center Play glyphs consistently over cover artwork. Keep empty-spacer pencils beside Trash with a full-width name lane.
- Move collection rename pencils after the name and immediately before Trash. Excluded folders support Ctrl+A/Command+A, Ctrl/Command-click and grouped Delete/Backspace or minus, with account-safe interruption and visible partial failures.
- Share anchored Shift-click/Shift+arrow selection across exclusions and available collections, including additive Ctrl/Command+Shift ranges. Add several selected collections to navigation in one saved operation, preserving all existing menus on refusal.
- Show the queue-style accent insertion line when reordering excluded folders or dropping a collection into navigation, including after the last row. Pointer and native drag now resolve the same position, with no row-height jump.
- Available collections can also be reordered before adding them. One insertion gap now has one stable accent line, preventing the apparent extra position at adjacent menu borders; a collection dragged into navigation still adds a shortcut without removing it from the picker.
