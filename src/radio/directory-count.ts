import { createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import { stationCount } from "./directory";
/** Optional directory metadata never owns or delays the station search busy state. */
export function createDirectoryCount(fetch: () => Promise<unknown>) {
  const [value, setValue] = createSignal<number>(),
    [error, setError] = createSignal("");
  let alive = true,
    running = false;
  onCleanup(() => {
    alive = false;
  });
  function refresh() {
    if (!alive || running || value() !== undefined) return;
    running = true;
    void fetch()
      .then((response) => {
        const count = stationCount(response);
        if (alive) {
          setValue(count);
          setError("");
        }
      })
      .catch(() => {
        if (alive) setError(t("Le total de l’annuaire est indisponible."));
      })
      .finally(() => {
        running = false;
      });
  }
  return { value, error, refresh };
}
