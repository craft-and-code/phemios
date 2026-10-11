import { createMemo, type Accessor } from "solid-js";
interface Cover {
  reference: string;
}
/** Index unique canonical references once per result; metadata-only replacements retain the viewport. */
export function createCoverCatalog(
  rows: Accessor<readonly Cover[]>,
  reverse: Accessor<boolean>,
  selected: Accessor<string>,
) {
  const positions = createMemo(() => new Map(rows().map((row, index) => [row.reference, index])));
  const index = createMemo(() => Math.max(0, positions().get(selected()) ?? -1));
  const order = createMemo(
    () =>
      `${reverse()}:${rows()
        .map((row) => row.reference)
        .join("\0")}`,
  );
  return { positions, index, order };
}
