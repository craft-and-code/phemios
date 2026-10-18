import { createEffect, createSignal } from "solid-js";
import type { PlayerVolume } from "./players";
import type { TransferOptions } from "./transfers";
/** Destination-dependent conversion recipe; no filesystem or native writes. */
export function createTransferRecipe(
  volumes: () => readonly PlayerVolume[] | undefined,
  pending: () => boolean,
) {
  const [selected, setSelected] = createSignal("");
  const [options, setOptions] = createSignal<TransferOptions>({
    format: "original",
    verify: true,
    replace: false,
  });
  createEffect(() => {
    const id = selected(),
      available = volumes();
    if (!id || (!pending() && available && !available.some((row) => row.id === id))) {
      setSelected("");
      setOptions({ format: "original", verify: true, replace: false });
    }
  });
  return {
    selected,
    options,
    setOptions,
    select(value: string) {
      setSelected(value);
      const adapter = volumes()?.find((row) => row.id === value)?.adapter;
      if (adapter === "ipod") setOptions({ format: "original", verify: false, replace: false });
      else if (adapter === "mtp") setOptions((previous) => ({ ...previous, replace: false }));
    },
  };
}
