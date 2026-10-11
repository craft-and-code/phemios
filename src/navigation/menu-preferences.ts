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
  labels?: Partial<Record<MenuItem, string>>;
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
  if (["moods", "favourites", "rated", "tags", "collections", "history", "playlists"].includes(id))
    return "heading:personal";
  if (["radio", "podcasts", "concerts"].includes(id)) return "heading:sources";
  if (
    [
      "doctor",
      "analysis",
      "relations",
      "statistics",
      "achievements",
      "encyclopedia",
      "players",
    ].includes(id)
  )
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
  const value = raw as { version?: unknown; order?: unknown; hidden?: unknown; labels?: unknown };
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
    (value.version !== 1 &&
      value.version !== 2 &&
      value.version !== 3 &&
      value.version !== 4 &&
      value.version !== 5) ||
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
  if (value.version !== 5 && tools.join(",") === "doctor,analysis,relations,statistics,players") {
    saved.splice(saved.indexOf("relations"), 1);
    saved.splice(saved.indexOf("doctor"), 0, "relations");
  }
  if (
    value.version !== 1 &&
    saved.includes("heading:sources") &&
    !saved.includes("concerts") &&
    saved.includes("podcasts")
  )
    saved.splice(saved.indexOf("podcasts") + 1, 0, "concerts");
  const legacyDefault = defaultMenuOrder().filter(
    (id) => !["encyclopedia", "achievements"].includes(id),
  );
  legacyDefault.splice(legacyDefault.indexOf("history"), 0, "achievements");
  legacyDefault.splice(legacyDefault.indexOf("podcasts") + 1, 0, "encyclopedia");
  if (
    value.version !== 3 &&
    value.version !== 4 &&
    value.version !== 5 &&
    saved.join(",") === legacyDefault.join(",")
  ) {
    for (const id of ["achievements", "encyclopedia"] as const) saved.splice(saved.indexOf(id), 1);
    saved.splice(saved.indexOf("players"), 0, "achievements", "encyclopedia");
  }
  const priorTools = saved.filter(
    (id) => ids().includes(id as Section) && menuHeading(id as Section) === "heading:tools",
  );
  if (
    value.version !== 4 &&
    value.version !== 5 &&
    priorTools.join(",") ===
      "relations,doctor,analysis,statistics,achievements,encyclopedia,players"
  ) {
    for (const id of ["encyclopedia", "achievements"] as const) saved.splice(saved.indexOf(id), 1);
    saved.splice(saved.indexOf("relations") + 1, 0, "encyclopedia", "achievements");
  }
  for (const id of ["encyclopedia", "achievements"] as const) {
    if (!saved.includes(id) && value.version !== 1) {
      const at = saved.indexOf(id === "encyclopedia" ? "relations" : "encyclopedia");
      if (at >= 0) saved.splice(at + 1, 0, id);
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
  const labels: Partial<Record<MenuItem, string>> = {};
  if (value.labels !== undefined) {
    if (!value.labels || typeof value.labels !== "object" || Array.isArray(value.labels))
      throw new Error(t("Configuration du menu illisible."));
    for (const [id, name] of Object.entries(value.labels)) {
      if (
        !order.includes(id as MenuItem) ||
        id.startsWith("separator:") ||
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 80 ||
        [...name].some((letter) => letter.charCodeAt(0) < 32 || letter.charCodeAt(0) === 127)
      )
        throw new Error(t("Configuration du menu illisible."));
      labels[id as MenuItem] = name.trim();
    }
  }
  return { order, hidden: [...value.hidden], ...(Object.keys(labels).length ? { labels } : {}) };
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
  const next = validate({ version: 5, ...value });
  const raw = JSON.stringify({ version: 5, ...next });
  if (raw.length > 8192) throw new Error(t("Configuration du menu illisible."));
  storage.setItem(key, raw);
  announceSetting(key, raw);
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

/** Custom names are literal in both languages; absent overrides use the translated default. */
export function menuLabel(id: MenuItem, preferences: MenuPreferences): string {
  return preferences.labels?.[id] ?? t(menuItem(id).label);
}
