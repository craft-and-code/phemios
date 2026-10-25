import { createMemo, type Accessor } from "solid-js";
import { useLibrary } from "./context";
import { referenceSource } from "./sources";
import { biographyLinker, type BiographyPart } from "./biography-links";

/** Use only admitted resident projections; opening prose never downloads a track index. */
export function createBiographyLinker(
  reference: Accessor<string>,
  supplied: Accessor<((text: string) => BiographyPart[]) | undefined> = () => undefined,
) {
  const library = useLibrary();
  return createMemo(
    () =>
      supplied() ??
      biographyLinker(library.artists(), reference(), {
        albums: library.albums(),
        tracks: library.publicSnapshot(referenceSource(reference()))?.tracks ?? [],
      }),
  );
}
