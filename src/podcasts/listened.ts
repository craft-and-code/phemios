import { createSignal } from "solid-js";
import { t } from "../i18n";
import { podcastUrl } from "./feed";
type Store = Pick<Storage, "getItem" | "setItem">;
interface ListenedEpisode {
  feed: string;
  id: string;
}
const key = "phemios.podcast-listened.v1";
function validate(row: unknown): ListenedEpisode {
  const value = row as ListenedEpisode;
  if (
    !value ||
    typeof value.feed !== "string" ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    value.id.length > 4096
  )
    throw new Error(t("Épisodes écoutés illisibles."));
  return { feed: podcastUrl(value.feed), id: value.id };
}
function read(storage: Store): ListenedEpisode[] {
  const raw = storage.getItem(key);
  if (raw === null) return [];
  if (raw.length > 4 * 1024 * 1024) throw new Error(t("Épisodes écoutés illisibles."));
  const data = JSON.parse(raw);
  if (!data || data.version !== 1 || !Array.isArray(data.episodes) || data.episodes.length > 4096)
    throw new Error(t("Épisodes écoutés illisibles."));
  const rows = data.episodes.map(validate) as ListenedEpisode[];
  if (new Set(rows.map((row) => JSON.stringify([row.feed, row.id]))).size !== rows.length)
    throw new Error(t("Épisodes écoutés illisibles."));
  return rows;
}
/** Device-local evidence survives feed refresh/removal; unreadable data is never overwritten. */
export function createListenedEpisodes(storage: Store = localStorage) {
  const [rows, setRows] = createSignal<ListenedEpisode[]>([]),
    [error, setError] = createSignal("");
  try {
    setRows(read(storage));
  } catch (failure) {
    setError(String(failure));
  }
  return {
    error,
    has: (feed: string, id: string) => rows().some((row) => row.feed === feed && row.id === id),
    mark(feed: string, id: string) {
      try {
        const row = validate({ feed, id }),
          next = read(storage);
        if (!next.some((held) => held.feed === row.feed && held.id === row.id)) next.push(row);
        const raw = JSON.stringify({ version: 1, episodes: next });
        if (next.length > 4096 || raw.length > 4 * 1024 * 1024)
          throw new Error(t("Limite de stockage des podcasts atteinte."));
        storage.setItem(key, raw);
        setRows(next);
        setError("");
      } catch (failure) {
        setError(String(failure));
      }
    },
  };
}
/** Union actual media TimeRanges; repeated ranges and skipped time never inflate evidence. */
export function episodeListened(
  ranges: readonly (readonly [number, number])[],
  duration: number,
): boolean {
  if (!Number.isFinite(duration) || duration <= 0 || ranges.length > 4096) return false;
  const valid = ranges
    .filter(
      ([start, end]) =>
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start >= 0 &&
        end > start &&
        end <= duration + 0.5,
    )
    .slice()
    .sort((a, b) => a[0] - b[0]);
  let total = 0,
    until = 0;
  for (const [start, end] of valid) {
    total += Math.max(0, Math.min(end, duration) - Math.max(start, until));
    until = Math.max(until, end);
  }
  return total >= duration * 0.9;
}
