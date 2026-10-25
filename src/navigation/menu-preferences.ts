import {
  isCollectionMenuId,
  validCollectionId,
  collectionMenuEntries,
  collectionMenuName,
  type CollectionMenuId,
} from "./collection-menu";
import { interfacePreferences } from "../library/account-preferences";
import { announceSetting } from "../library/saved-settings";
import { getOwner, onCleanup } from "solid-js";
import { createSignal } from "solid-js";
import { t } from "../i18n";
import { sections, type Section } from "./routes";
type LegacyMenuItem = MenuItem | "recent";
type Store = Pick<Storage, "getItem" | "setItem">;
export type MenuItem =
  | Section
  | CollectionMenuId
  | "heading:library"
  | "heading:personal"
  | "heading:sources"
  | "heading:tools"
  | `separator:${string}`;
export interface MenuPreferences {
  order: MenuItem[];
  hidden: MenuItem[];
  labels?: Partial<Record<MenuItem, string>>;
  collections?: Partial<Record<CollectionMenuId, string>>;
  collectionIds?: Partial<Record<CollectionMenuId, string>>;
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
  if (["radio", "podcasts", "cd", "concerts"].includes(id)) return "heading:sources";
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
export function menuItem(id: MenuItem, preferences?: MenuPreferences) {
  if (isCollectionMenuId(id))
    return {
      id,
      kind: "collection" as const,
      label: preferences
        ? (collectionMenuName(preferences, id) ?? t("Collection indisponible"))
        : t("Collection"),
      symbol: "library",
    };
  const section = sections.find((row) => row.id === id);
  return section
    ? { ...section, kind: "section" as const }
    : {
        id,
        kind:
          id.startsWith("separator:") && !preferences?.labels?.[id]
            ? ("separator" as const)
            : ("heading" as const),
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
  const value = raw as {
    version?: unknown;
    order?: unknown;
    hidden?: unknown;
    labels?: unknown;
    collections?: unknown;
    collectionIds?: unknown;
  };
  const validId = (id: unknown): id is LegacyMenuItem =>
    typeof id === "string" &&
    (id === "recent" ||
      ids().includes(id as Section) ||
      Object.hasOwn(headings, id) ||
      isCollectionMenuId(id) ||
      /^separator:[a-zA-Z0-9-]{1,40}$/.test(id));
  const valid = (rows: unknown): rows is LegacyMenuItem[] =>
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
      value.version !== 5 &&
      value.version !== 6 &&
      value.version !== 7 &&
      value.version !== 8 &&
      value.version !== 9) ||
    !valid(value.order) ||
    !valid(value.hidden)
  )
    throw new Error(t("Configuration du menu illisible."));
  if (
    value.version === 1 &&
    [...value.order, ...value.hidden].some(
      (id) => id !== "recent" && !ids().includes(id as Section),
    )
  )
    throw new Error(t("Configuration du menu illisible."));
  if (
    value.version !== 7 &&
    value.version !== 8 &&
    value.version !== 9 &&
    (value.collections !== undefined || [...value.order, ...value.hidden].some(isCollectionMenuId))
  )
    throw new Error(t("Configuration du menu illisible."));
  const saved: MenuItem[] = value.order.filter((id): id is MenuItem => id !== "recent");
  const hidden: MenuItem[] = value.hidden.filter((id): id is MenuItem => id !== "recent");
  const tools = saved.filter((id) =>
    ["doctor", "analysis", "relations", "statistics", "players"].includes(id),
  );
  if (
    value.version !== 5 &&
    value.version !== 6 &&
    value.version !== 7 &&
    value.version !== 8 &&
    value.version !== 9 &&
    tools.join(",") === "doctor,analysis,relations,statistics,players"
  ) {
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
    value.version !== 6 &&
    value.version !== 7 &&
    value.version !== 8 &&
    value.version !== 9 &&
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
    value.version !== 6 &&
    value.version !== 7 &&
    value.version !== 8 &&
    value.version !== 9 &&
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
  if (!saved.includes("cd") && saved.includes("concerts"))
    saved.splice(saved.indexOf("concerts"), 0, "cd");
  if (!saved.includes("composers") && saved.includes("genres"))
    saved.splice(saved.indexOf("genres") + 1, 0, "composers");
  const oldDefault = ids().filter((id) => saved.includes(id));
  const untouched =
    value.version === 1 &&
    saved.length === oldDefault.length &&
    saved.every((id, index) => id === oldDefault[index]);
  const order = addHeadings(
    untouched ? ids() : [...saved, ...ids().filter((id) => !saved.includes(id))],
  );
  if (order.length > 96 || hidden.some((id) => !order.includes(id)))
    throw new Error(t("Configuration du menu illisible."));
  const labels: Partial<Record<MenuItem, string>> = {};
  if (value.labels !== undefined) {
    if (!value.labels || typeof value.labels !== "object" || Array.isArray(value.labels))
      throw new Error(t("Configuration du menu illisible."));
    for (const [id, name] of Object.entries(value.labels)) {
      if (id === "recent") continue;
      if (
        !order.includes(id as MenuItem) ||
        (id.startsWith("separator:") && value.version !== 9) ||
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 80 ||
        [...name].some((letter) => letter.charCodeAt(0) < 32 || letter.charCodeAt(0) === 127)
      )
        throw new Error(t("Configuration du menu illisible."));
      labels[id as MenuItem] = name.trim();
    }
  }
  const collections = collectionMenuEntries(order, value.collections);
  if (
    value.collectionIds !== undefined &&
    ((value.version !== 8 && value.version !== 9) ||
      !value.collectionIds ||
      typeof value.collectionIds !== "object" ||
      Array.isArray(value.collectionIds))
  )
    throw new Error(t("Configuration du menu illisible."));
  const collectionIds: Partial<Record<CollectionMenuId, string>> = {};
  for (const [id, target] of Object.entries(value.collectionIds ?? {})) {
    if (!isCollectionMenuId(id) || !order.includes(id) || !validCollectionId(target))
      throw new Error(t("Configuration du menu illisible."));
    collectionIds[id] = target;
    delete labels[id];
  }
  return {
    order,
    hidden,
    ...(Object.keys(labels).length ? { labels } : {}),
    ...(Object.keys(collectionIds).length ? { collectionIds } : {}),
    ...(Object.keys(collections).length ? { collections } : {}),
  };
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
  const next = validate({ version: 9, ...value });
  const raw = JSON.stringify({ version: 9, ...next });
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
export function createMenuPreferences(storage: Store = interfacePreferences) {
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
    update(next: MenuPreferences | (() => MenuPreferences)) {
      try {
        setValue(saveMenuPreferences(storage, typeof next === "function" ? next() : next));
        setError("");
        return true;
      } catch (failure) {
        setError(String(failure));
        return false;
      }
    },
    reset() {
      this.update({ order: defaultMenuOrder(), hidden: [] });
    },
  };
}
/** Empty groups disappear while explicit spacers retain their chosen position. */
export function visibleMenu(
  value: MenuPreferences,
  unavailable: ReadonlySet<MenuItem> = new Set(),
): MenuItem[] {
  const order = value.order.filter((id) => !value.hidden.includes(id) && !unavailable.has(id));
  return order.filter((id, index) => {
    if (!id.startsWith("heading:")) return true;
    const end = order.findIndex((next, i) => i > index && menuItem(next, value).kind === "heading");
    return order
      .slice(index + 1, end < 0 ? undefined : end)
      .some((next) => ["section", "collection"].includes(menuItem(next, value).kind));
  });
}

/** Custom names are literal in both languages; absent overrides use the translated default. */
export function menuLabel(id: MenuItem, preferences: MenuPreferences): string {
  return (
    (isCollectionMenuId(id) && preferences.collectionIds?.[id]
      ? undefined
      : preferences.labels?.[id]) ??
    (isCollectionMenuId(id)
      ? (collectionMenuName(preferences, id) ?? t("Collection indisponible"))
      : t(menuItem(id).label))
  );
}

/** An empty spacer name restores blank space; a named spacer is a presentation heading. */
export function renameMenuItem(
  value: MenuPreferences,
  id: MenuItem,
  name: string,
): MenuPreferences {
  const labels = { ...value.labels };
  if (id.startsWith("separator:") && !name.trim()) delete labels[id];
  else labels[id] = name.trim();
  return { ...value, labels };
}
/** Removing a custom spacer also retires its label and visibility preference. */
export function removeMenuSpacer(
  value: MenuPreferences,
  id: `separator:${string}`,
): MenuPreferences {
  const labels = { ...value.labels };
  delete labels[id];
  return {
    ...value,
    labels,
    order: value.order.filter((row) => row !== id),
    hidden: value.hidden.filter((row) => row !== id),
  };
}
