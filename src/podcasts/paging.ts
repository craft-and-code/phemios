import { createEffect, createSignal, on, type Accessor } from "solid-js";
import type { Episode } from "./feed";
export const episodePageSize = 25;
/** Page retained metadata locally; owner/feed/search changes retire the previous window. */
export function createEpisodePaging(
  episodes: Accessor<readonly Episode[]>,
  scope: Accessor<unknown>,
) {
  const [offset, setOffset] = createSignal(0);
  const maximum = () =>
    Math.max(0, Math.ceil(episodes().length / episodePageSize) - 1) * episodePageSize;
  createEffect(on(scope, () => setOffset(0)));
  createEffect(() => {
    const max = maximum();
    setOffset((value) => Math.min(value, max));
  });
  return {
    offset,
    total: () => episodes().length,
    rows: () => episodes().slice(offset(), offset() + episodePageSize),
    select(value: number) {
      if (Number.isSafeInteger(value) && value >= 0 && value % episodePageSize === 0)
        setOffset(Math.min(value, maximum()));
    },
  };
}
