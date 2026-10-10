import { announceSetting } from "../library/saved-settings";
import { getOwner, onCleanup } from "solid-js";
import { createSignal } from "solid-js";
import { t } from "../i18n";
import { sections, type Section } from "./routes";
type Store = Pick<Storage, "getItem" | "setItem">;
export type MenuItem =
  | Section
  | "heading:library"
  | "heading:personal"
  | "heading:sources"
  | "heading:tools"
  | `separator:${string}`;
export interface MenuPreferences {
  order: MenuItem[];
  hidden: MenuItem[];
}
const key = "phemios.navigation.v1";
const ids = () => sections.map((section) => section.id);
const headings = {
  "heading:library": "BIBLIOTHÈQUE",
  "heading:personal": "VOTRE MUSIQUE",
  "heading:sources": "SOURCES MUSICALES",
  "heading:tools": "OUTILS",
} as const;
export function menuHeading(id: Section): MenuItem {
  if (
    [
      "moods",
      "favourites",
      "rated",
      "tags",
      "collections",
      "history",
      "playlists",
      "achievements",
    ].includes(id)
  )
    return "heading:personal";
  if (["radio", "podcasts", "encyclopedia"].includes(id)) return "heading:sources";
  if (["doctor", "analysis", "relations", "statistics", "players"].includes(id))
    return "heading:tools";
  return "heading:library";
}
export function menuItem(id: MenuItem) {
  const section = sections.find((row) => row.id === id);
  return section
    ? { ...section, kind: "section" as const }
    : {
        id,
        kind: id.startsWith("separator:") ? ("separator" as const) : ("heading" as const),
        label: id.startsWith("separator:")
          ? t("Espacement")
          : t(headings[id as keyof typeof headings]),
        symbol: "menu",
      };
}
function addHeadings(order: readonly MenuItem[]): MenuItem[] {
  const retained = new Set(order),
    result: MenuItem[] = [];
  for (const id of order) {
    if (ids().includes(id as Section)) {
      const heading = menuHeading(id as Section);
      if (!retained.has(heading)) {
        result.push(heading);
        retained.add(heading);
      }
    }
    result.push(id);
  }
  return result;
}
export const defaultMenuOrder = () => addHeadings(ids());
function validate(raw: unknown): MenuPreferences {
  const value = raw as { version?: unknown; order?: unknown; hidden?: unknown };
  const validId = (id: unknown): id is MenuItem =>
    typeof id === "string" &&
    (ids().includes(id as Section) ||
      Object.hasOwn(headings, id) ||
      /^separator:[a-zA-Z0-9-]{1,40}$/.test(id));
  const valid = (rows: unknown): rows is MenuItem[] =>
    Array.isArray(rows) &&
    rows.length <= 96 &&
    new Set(rows).size === rows.length &&
    rows.every(validId);
  if (
    !value ||
    (value.version !== 1 && value.version !== 2) ||
    !valid(value.order) ||
    !valid(value.hidden)
  )
    throw new Error(t("Configuration du menu illisible."));
  if (
    value.version === 1 &&
    [...value.order, ...value.hidden].some((id) => !ids().includes(id as Section))
  )
    throw new Error(t("Configuration du menu illisible."));
  const saved = [...value.order];
  const tools = saved.filter((id) =>
    ["doctor", "analysis", "relations", "statistics", "players"].includes(id),
  );
  if (tools.join(",") === "doctor,analysis,relations,statistics,players") {
    saved.splice(saved.indexOf("relations"), 1);
    saved.splice(saved.indexOf("doctor"), 0, "relations");
  }
  for (const id of ["encyclopedia", "achievements"] as const) {
    if (!saved.includes(id) && value.version === 2) {
      const anchor = id === "encyclopedia" ? "podcasts" : "history";
      const at = saved.indexOf(anchor);
      if (at >= 0) saved.splice(at + (id === "encyclopedia" ? 1 : 0), 0, id);
    }
  }
  const oldDefault = ids().filter((id) => saved.includes(id));
  const untouched =
    value.version === 1 &&
    saved.length === oldDefault.length &&
    saved.every((id, index) => id === oldDefault[index]);
  const order = addHeadings(
    untouched ? ids() : [...saved, ...ids().filter((id) => !saved.includes(id))],
  );
  if (order.length > 96 || value.hidden.some((id) => !order.includes(id)))
    throw new Error(t("Configuration du menu illisible."));
  return { order, hidden: [...value.hidden] };
}
/** New sections remain visible by default; corrupt preferences are never replaced implicitly. */
export function readMenuPreferences(storage: Pick<Storage, "getItem">): MenuPreferences {
  const raw = storage.getItem(key);
  if (raw === null) return { order: defaultMenuOrder(), hidden: [] };
  if (raw.length > 8192) throw new Error(t("Configuration du menu illisible."));
  return validate(JSON.parse(raw));
}
/** Check the retained store before publishing a validated device-local menu configuration. */
export function saveMenuPreferences(storage: Store, value: MenuPreferences): MenuPreferences {
  readMenuPreferences(storage);
  const next = validate({ version: 2, ...value });
  storage.setItem(key, JSON.stringify({ version: 2, ...next }));
  announceSetting(key, JSON.stringify({ version: 2, ...next }));
  return next;
}
/** Move one item before a target; invalid or self targets retain the complete original order. */
export function moveMenu(order: readonly MenuItem[], item: MenuItem, before: MenuItem): MenuItem[] {
  if (item === before || !order.includes(item) || !order.includes(before)) return [...order];
  const next = order.filter((id) => id !== item);
  next.splice(next.indexOf(before), 0, item);
  return next;
}
/** The shell and Settings share this confirmed state; saving failure leaves navigation unchanged. */
export function createMenuPreferences(storage: Store = localStorage) {
  const [value, setValue] = createSignal<MenuPreferences>({
    order: defaultMenuOrder(),
    hidden: [],
  });
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
      this.update({ order: defaultMenuOrder(), hidden: [] });
    },
  };
}
/** Empty groups disappear while explicit spacers retain their chosen position. */
export function visibleMenu(value: MenuPreferences): MenuItem[] {
  const order = value.order.filter((id) => !value.hidden.includes(id));
  return order.filter((id, index) => {
    if (!id.startsWith("heading:")) return true;
    const end = order.findIndex((next, i) => i > index && next.startsWith("heading:"));
    return order
      .slice(index + 1, end < 0 ? undefined : end)
      .some((next) => menuItem(next).kind === "section");
  });
}
