import type { AccountSession } from "../library/server";
import type { SourceId } from "../library/sources";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import type { Station } from "./directory";
import { readRadioFavourites } from "./favourites";
export const radioAccountKey = "phemios.radio-favourites";
/** Stable source/authority/account identity; login renames do not create another favourite owner. */
export function radioFavouriteOwner(source: SourceId, session: AccountSession | undefined) {
  return session ? `${source}|${session.server}|${session.account.id}` : undefined;
}
/** Current-owner preferences retain only public station metadata; playback never uses this service. */
export function createAccountRadioFavourites(
  owner: () => string | undefined,
  request: (owner: string, method: "GET" | "PATCH", body?: unknown) => Promise<unknown>,
) {
  const [stations, setStations] = createSignal<Station[]>([]),
    [error, setError] = createSignal(""),
    [busy, setBusy] = createSignal(false),
    [loaded, setLoaded] = createSignal(false);
  const identity = createMemo(owner);
  let generation = 0;
  const decode = (value: unknown) =>
    readRadioFavourites({ getItem: () => JSON.stringify(value), setItem: () => {} });
  createEffect(() => {
    const heldOwner = identity(),
      epoch = ++generation;
    setStations([]);
    setLoaded(false);
    setBusy(false);
    setError("");
    if (!heldOwner) return;
    void (async () => {
      try {
        const response = (await request(heldOwner, "GET")) as { values?: Record<string, unknown> };
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
    const heldOwner = identity(),
      epoch = generation;
    if (!heldOwner || !loaded() || busy()) return;
    setBusy(true);
    setError("");
    try {
      const value = { version: 1, stations: decode({ version: 1, stations: rows }) };
      if (new TextEncoder().encode(JSON.stringify(value)).length > 8192)
        throw Error(t("La limite de favoris radio du compte est atteinte."));
      await request(heldOwner, "PATCH", { values: { [radioAccountKey]: value } });
      if (epoch === generation && heldOwner === identity()) setStations(value.stations);
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
    available: () => !!identity() && loaded(),
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
