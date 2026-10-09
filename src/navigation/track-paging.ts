import { t } from "../i18n";
import { createEffect, createMemo, createSignal, on, type Accessor } from "solid-js";
/** Shell-owned page state survives detail remounts; new search/session scopes restart at zero. */
export function createTrackPaging(query: Accessor<string>, session: Accessor<unknown>) {
  const [offset, set] = createSignal(0),
    search = createMemo(query);
  createEffect(
    on(
      () => [search(), session()],
      () => set(0),
    ),
  );
  const setOffset = (value: number) => {
    if (!Number.isSafeInteger(value) || value < 0 || value % 50 !== 0)
      throw new Error(t("Page de pistes invalide."));
    set(value);
  };
  return { offset, setOffset };
}
