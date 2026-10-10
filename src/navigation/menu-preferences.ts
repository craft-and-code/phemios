import { announceSetting } from "../library/saved-settings";
import { getOwner, onCleanup } from "solid-js";
import { createSignal } from "solid-js";
import { t } from "../i18n";
import { sections, type Section } from "./routes";
type Store = Pick<Storage, "getItem" | "setItem">;
export interface MenuPreferences {
  order: Section[];
  hidden: Section[];
}
const key = "phemios.navigation.v1";
const ids = () => sections.map((section) => section.id);
function validate(raw: unknown): MenuPreferences {
  const value = raw as { version?: unknown; order?: unknown; hidden?: unknown };
  const valid = (rows: unknown): rows is Section[] =>
    Array.isArray(rows) &&
    rows.length <= ids().length &&
    new Set(rows).size === rows.length &&
    rows.every((id) => ids().includes(id));
  if (!value || value.version !== 1 || !valid(value.order) || !valid(value.hidden))
    throw new Error(t("Configuration du menu illisible."));
  const savedOrder = value.order;
  const oldDefault = ids().filter((id) => savedOrder.includes(id));
  const order =
    value.order.every((id, index) => id === oldDefault[index]) &&
    value.order.length === oldDefault.length
      ? ids()
      : value.order;
  return {
    order: [...order, ...ids().filter((id) => !order.includes(id))],
    hidden: [...value.hidden],
  };
}
/** New sections remain visible by default; corrupt preferences are never replaced implicitly. */
export function readMenuPreferences(storage: Pick<Storage, "getItem">): MenuPreferences {
  const raw = storage.getItem(key);
  if (raw === null) return { order: ids(), hidden: [] };
  if (raw.length > 8192) throw new Error(t("Configuration du menu illisible."));
  return validate(JSON.parse(raw));
}
/** Check the retained store before publishing a validated device-local menu configuration. */
export function saveMenuPreferences(storage: Store, value: MenuPreferences): MenuPreferences {
  readMenuPreferences(storage);
  const next = validate({ version: 1, ...value });
  storage.setItem(key, JSON.stringify({ version: 1, ...next }));
  announceSetting(key, JSON.stringify({ version: 1, ...next }));
  return next;
}
/** Move one item before a target; invalid or self targets retain the complete original order. */
export function moveMenu(order: readonly Section[], item: Section, before: Section): Section[] {
  if (item === before || !order.includes(item) || !order.includes(before)) return [...order];
  const next = order.filter((id) => id !== item);
  next.splice(next.indexOf(before), 0, item);
  return next;
}
/** The shell and Settings share this confirmed state; saving failure leaves navigation unchanged. */
export function createMenuPreferences(storage: Store = localStorage) {
  const [value, setValue] = createSignal<MenuPreferences>({ order: ids(), hidden: [] });
  const [error, setError] = createSignal("");
  try {
    setValue(readMenuPreferences(storage));
  } catch (failure) {
    setError(String(failure));
  }
  if (typeof window !== "undefined" && getOwner()) {
    const reload = () => {
      try {
        setValue(readMenuPreferences(storage));
        setError("");
      } catch (failure) {
        setError(String(failure));
      }
    };
    window.addEventListener("phemios-settings-loaded", reload);
    onCleanup(() => window.removeEventListener("phemios-settings-loaded", reload));
  }
  return {
    value,
    error,
    update(next: MenuPreferences) {
      try {
        setValue(saveMenuPreferences(storage, next));
        setError("");
      } catch (failure) {
        setError(String(failure));
      }
    },
    reset() {
      this.update({ order: ids(), hidden: [] });
    },
  };
}
/** Group headings follow the chosen order, never empty or repeated merely because a leading menu is hidden. */
export function menuGroup(id: Section): string {
  if (["moods", "favourites", "rated", "tags", "collections", "history", "playlists"].includes(id))
    return t("VOTRE MUSIQUE");
  if (["radio", "podcasts"].includes(id)) return t("SOURCES MUSICALES");
  if (["doctor", "analysis", "relations", "statistics", "players"].includes(id)) return t("OUTILS");
  return t("BIBLIOTHÈQUE");
}
