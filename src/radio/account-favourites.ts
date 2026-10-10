import { createEffect, createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import type { Station } from "./directory";
import { readRadioFavourites } from "./favourites";
export const radioAccountKey = "phemios.radio-favourites";
/** Current-owner preferences retain only public station metadata; playback never uses this service. */
export function createAccountRadioFavourites(
  owner: () => string | undefined,
  request: (owner: string, method: "GET" | "PATCH", body?: unknown) => Promise<unknown>,
) {
  const [stations, setStations] = createSignal<Station[]>([]),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [loaded, setLoaded] = createSignal(false);
  let generation = 0;
  const decode = (value: unknown) =>
    readRadioFavourites({ getItem: () => JSON.stringify(value), setItem: () => {} });
  createEffect(() => {
    const identity = owner(),
      epoch = ++generation;
    setStations([]);
    setLoaded(false);
    setBusy(false);
    setError("");
    if (!identity) return;
    void (async () => {
      try {
        const response = (await request(identity, "GET")) as { values?: Record<string, unknown> };
        if (
          !response ||
          !response.values ||
          typeof response.values !== "object" ||
          Array.isArray(response.values)
        )
          throw Error(t("Favoris radio illisibles."));
        const rows = Object.hasOwn(response.values, radioAccountKey)
          ? decode(response.values[radioAccountKey])
          : [];
        if (epoch === generation) {
          setStations(rows);
          setLoaded(true);
        }
      } catch (failure) {
        if (epoch === generation) setError(String(failure));
      }
    })();
  });
  onCleanup(() => generation++);
  async function publish(rows: Station[]) {
    const identity = owner(),
      epoch = generation;
    if (!identity || !loaded() || busy()) return;
    setBusy(true);
    setError("");
    try {
      const value = { version: 1, stations: decode({ version: 1, stations: rows }) };
      if (new TextEncoder().encode(JSON.stringify(value)).length > 8192)
        throw Error(t("La limite de favoris radio du compte est atteinte."));
      await request(identity, "PATCH", { values: { [radioAccountKey]: value } });
      if (epoch === generation && identity === owner()) setStations(value.stations);
    } catch (failure) {
      if (epoch === generation) setError(String(failure));
    } finally {
      if (epoch === generation) setBusy(false);
    }
  }
  return {
    stations,
    error,
    busy,
    available: () => !!owner() && loaded(),
    has: (uuid: string) => stations().some((row) => row.uuid === uuid),
    toggle: (row: Station) =>
      publish(
        stations().some((value) => value.uuid === row.uuid)
          ? stations().filter((value) => value.uuid !== row.uuid)
          : [...stations(), row],
      ),
    importDevice: (rows: Station[]) =>
      publish([
        ...stations(),
        ...rows.filter((row) => !stations().some((value) => value.uuid === row.uuid)),
      ]),
  };
}
