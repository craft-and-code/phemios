import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import type { AccountSession } from "./server";
/** Editable server paths follow confirmed discovery without altering the remote roots. */
export function createServerRootEditor(
  owner: () => AccountSession | undefined,
  confirmed: () => readonly string[] | undefined,
) {
  const [rows, setRows] = createStore<{ id: number; path: string }[]>([]);
  let id = 0,
    previousOwner = owner();
  createEffect(() => {
    const currentOwner = owner();
    if (currentOwner !== previousOwner) {
      setRows([]);
      previousOwner = currentOwner;
    }
    const paths = confirmed();
    if (paths) setRows(paths.map((path) => ({ id: id++, path })));
  });
  return { rows, setRows, nextId: () => id++ };
}
