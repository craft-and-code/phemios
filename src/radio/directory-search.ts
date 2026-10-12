import { batch, createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import { parseStations, type Station } from "./directory";
import type { RadioCriteria } from "./search";
/** One already-validated public page retained in process memory, without owner data or media URLs. */
export interface DirectorySnapshot {
  criteria: RadioCriteria;
  stations: readonly Station[];
  more: boolean;
  offset: number;
  selected: number;
  loaded: boolean;
  error: string;
}
interface SearchRequest {
  criteria: RadioCriteria;
  offset: number;
  epoch: number;
}
/** Account-independent searches serialize provider reads and keep only the latest submitted criteria.
 * A fresh selection immediately clears unrelated results; pagination failures retain the same selection.
 * Queued requests capture their submitted fields, and disposal permanently refuses new provider reads.
 */
export function createDirectorySearch(
  draft: () => RadioCriteria,
  fetch: (criteria: RadioCriteria, offset: number) => Promise<unknown>,
  completed: () => void,
  remember: (country: string) => void,
  retained?: DirectorySnapshot,
) {
  const [stations, setStations] = createSignal<Station[]>([...(retained?.stations ?? [])]),
    [more, setMore] = createSignal(retained?.more ?? false),
    [offset, setOffset] = createSignal(retained?.offset ?? 0),
    [selected, setSelected] = createSignal(retained?.selected ?? 0),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal(retained?.error ?? ""),
    [loaded, setLoaded] = createSignal(retained?.loaded ?? false);
  let criteria: RadioCriteria = {
      ...(retained?.criteria ?? { name: "", country: "", tag: "", secureOnly: true }),
    },
    alive = true,
    pending: SearchRequest | undefined,
    searchEpoch = 0;
  onCleanup(() => {
    alive = false;
    searchEpoch++;
    pending = undefined;
  });
  function resetRows() {
    batch(() => {
      setStations([]);
      setLoaded(false);
      setMore(false);
      setOffset(0);
      setSelected(0);
      setError("");
    });
  }
  async function run(request: SearchRequest) {
    if (!alive || request.epoch !== searchEpoch) return;
    setBusy(true);
    setError("");
    try {
      const raw = await fetch(request.criteria, request.offset);
      if (!alive || request.epoch !== searchEpoch || request.criteria.country !== draft().country)
        return;
      const response = parseStations(raw);
      batch(() => {
        setStations(response.stations);
        setMore(response.more);
        setOffset(request.offset);
        setSelected(0);
        setLoaded(true);
      });
      completed();
    } catch (failure) {
      if (alive && request.epoch === searchEpoch)
        setError(failure instanceof Error ? failure.message : t("Annuaire radio indisponible."));
    } finally {
      if (alive) {
        setBusy(false);
        const next = pending;
        pending = undefined;
        if (next) void run(next);
      }
    }
  }
  async function search(page = 0, fresh = false, persist = true) {
    if (!alive || (busy() && !fresh)) return;
    if (fresh) {
      searchEpoch++;
      criteria = { ...draft() };
      resetRows();
      if (persist) remember(criteria.country);
    }
    const request = { criteria: { ...criteria }, offset: page, epoch: searchEpoch };
    if (busy()) {
      pending = request;
      return;
    }
    await run(request);
  }
  return {
    snapshot: (): DirectorySnapshot => ({
      criteria: { ...criteria },
      stations: [...stations()],
      more: more(),
      offset: offset(),
      selected: selected(),
      loaded: loaded(),
      error: error(),
    }),
    stations,
    more,
    offset,
    selected,
    busy,
    error,
    loaded,
    search,
    setSelected,
    clearError: () => setError(""),
    clear: () => {
      searchEpoch++;
      pending = undefined;
      resetRows();
    },
  };
}
