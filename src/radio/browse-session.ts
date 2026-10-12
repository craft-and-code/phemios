import type { DirectorySnapshot } from "./directory-search";
import type { RadioCriteria } from "./search";
interface BrowseSnapshot {
  draft: RadioCriteria;
  directory: DirectorySnapshot;
}
function copy(value: BrowseSnapshot): BrowseSnapshot {
  return {
    draft: { ...value.draft },
    directory: {
      ...value.directory,
      criteria: { ...value.directory.criteria },
      stations: value.directory.stations.map((station) => ({ ...station })),
    },
  };
}
/** Retain one bounded public directory page for this process, never credentials, favourites or media.
 * Submitted criteria remain distinct from unsent fields; view disposal cannot mutate saved rows.
 */
export function createRadioBrowseSession() {
  let snapshot: BrowseSnapshot | undefined;
  return {
    read: () => (snapshot ? copy(snapshot) : undefined),
    remember(draft: RadioCriteria, directory: DirectorySnapshot) {
      if (directory.stations.length > 50) throw new Error("Radio browse page exceeds its bound");
      snapshot = copy({ draft, directory });
    },
  };
}
/** Account-independent browsing survives ordinary route remounts and resets when the app exits. */
export const radioBrowseSession = createRadioBrowseSession();
