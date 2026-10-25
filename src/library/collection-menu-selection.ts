import { createMemo, createSignal } from "solid-js";
import { addCollectionMenu, type SavedCollection } from "../navigation/collection-menu";
import type { createMenuPreferences } from "../navigation/menu-preferences";
import { t } from "../i18n";
import { reorderObjects } from "./object-list";
interface Directory {
  rows: () => readonly SavedCollection[];
  identity: () => unknown;
  loading: () => boolean;
}
/** Owner-scoped presentation order and selected immutable IDs admit one complete menu write. */
export function createCollectionMenuSelection(options: {
  menu: ReturnType<typeof createMenuPreferences>;
  choices: () => Directory | undefined;
}) {
  const owner = createMemo(() => {
    const identity = options.choices()?.identity();
    const [order, setOrder] = createSignal<readonly string[]>([]);
    return { identity, order, setOrder };
  });
  const rows = createMemo(() => {
    const order = owner().order(),
      rank = new Map(order.map((id, index) => [id, index]));
    return [...(options.choices()?.rows() ?? [])].sort(
      (a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length),
    );
  });
  const [selected, setSelected] = createSignal<{ owner: unknown; ids: readonly string[] }>();
  const selections = createMemo(() => {
    const held = selected();
    if (!owner().identity || !held || held.owner !== owner()) return [];
    const ids = new Set(held.ids);
    return rows()
      .filter((row) => ids.has(row.id))
      .map((row) => row.id);
  });
  const selectMany = (ids: readonly string[]) => {
    const admitted = new Set(
      options
        .choices()
        ?.rows()
        .map((row) => row.id),
    );
    setSelected({ owner: owner(), ids: [...new Set(ids.filter((id) => admitted.has(id)))] });
  };
  return {
    rows,
    // Ordering this picker never changes a collection rule or persists a menu shortcut.
    reorder: (id: string, before?: string) => {
      if (!owner().identity || options.choices()?.loading()) return;
      owner().setOrder(
        reorderObjects(
          rows().map((row) => row.id),
          id,
          before,
        ),
      );
    },
    selections,
    selection: () => selections()[0],
    select: (id: string) => selectMany([id]),
    selectMany,
    add: () => {
      const held = owner(),
        ids = new Set(selections());
      if (!held.identity || !ids.size || options.choices()?.loading()) return false;
      const saved = options.menu.update(() => {
        if (held !== owner() || held.identity !== options.choices()?.identity())
          throw new Error(t("Session remplacée ou déconnectée. Reconnectez-vous."));
        return rows()
          .filter((row) => ids.has(row.id))
          .reduce(
            (menu, row) =>
              addCollectionMenu(menu, `collection:${crypto.randomUUID()}`, row.name, "", row.id),
            options.menu.value(),
          );
      });
      if (saved) setSelected(undefined);
      return saved;
    },
  };
}
