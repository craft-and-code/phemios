import { t } from "../i18n";
import type { MenuPreferences, MenuItem } from "./menu-preferences";
export function validCollectionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(collection-[0-9a-f]{64}|collection-legacy-[0-9a-f]{32})$/.test(value)
  );
}
export interface SavedCollection {
  id: string;
  name: string;
}
export type CollectionMenuId = `collection:${string}`;
const pattern = /^collection:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Opaque shortcut identities keep collection names out of navigation URLs. */
export function isCollectionMenuId(value: unknown): value is CollectionMenuId {
  return typeof value === "string" && pattern.test(value);
}
/** Names are canonical server identities, bounded by Aède's 256-byte name contract. */
export function validCollectionName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !!value.trim() &&
    value === value.trim() &&
    new TextEncoder().encode(value).length <= 256
  );
}
/** Validate complete references before admitting a stored or imported owner menu. */
export function collectionMenuEntries(
  order: readonly MenuItem[],
  raw: unknown,
): Partial<Record<CollectionMenuId, string>> {
  if (raw !== undefined && (!raw || typeof raw !== "object" || Array.isArray(raw)))
    throw new Error(t("Configuration du menu illisible."));
  const entries = Object.entries(raw ?? {});
  if (
    entries.length > 96 ||
    entries.some(
      ([id, name]) => !isCollectionMenuId(id) || !order.includes(id) || !validCollectionName(name),
    )
  )
    throw new Error(t("Configuration du menu illisible."));
  const result = Object.fromEntries(entries) as Partial<Record<CollectionMenuId, string>>;
  if (order.some((id) => isCollectionMenuId(id) && !Object.hasOwn(result, id)))
    throw new Error(t("Configuration du menu illisible."));
  return result;
}
/** Resolve only shortcuts actually present in the active account's menu projection. */
export function collectionMenuName(
  value: MenuPreferences,
  id: CollectionMenuId,
): string | undefined {
  return value.order.includes(id) ? value.collections?.[id] : undefined;
}
/** Creating a shortcut never creates, replaces or copies a collection rule. */
export function addCollectionMenu(
  value: MenuPreferences,
  id: CollectionMenuId,
  name: string,
  label = "",
  targetId?: string,
): MenuPreferences {
  if (
    (targetId !== undefined && !validCollectionId(targetId)) ||
    !isCollectionMenuId(id) ||
    !validCollectionName(name) ||
    value.order.includes(id) ||
    value.order.length >= 96
  )
    throw new Error(t("Impossible d’ajouter ce menu de collection."));
  return {
    ...value,
    order: [...value.order, id],
    collections: { ...value.collections, [id]: name },
    ...(targetId ? { collectionIds: { ...value.collectionIds, [id]: targetId } } : {}),
    ...(label.trim() && !targetId ? { labels: { ...value.labels, [id]: label.trim() } } : {}),
  };
}
/** Removing a shortcut retains the collection and any other shortcut that targets it. */
export function removeCollectionMenu(
  value: MenuPreferences,
  id: CollectionMenuId,
): MenuPreferences {
  const collections = { ...value.collections },
    labels = { ...value.labels },
    collectionIds = { ...value.collectionIds };
  delete collections[id];
  delete collectionIds[id];
  delete labels[id];
  return {
    ...value,
    order: value.order.filter((key) => key !== id),
    hidden: value.hidden.filter((key) => key !== id),
    collections,
    collectionIds,
    labels,
  };
}
/** Stable hash route consumed by the native asset shell and browser navigation. */
export function collectionMenuHref(id: CollectionMenuId): string {
  return `#/collection/${id.slice("collection:".length)}`;
}

/** Canonical names follow IDs; only legacy name references can be bound once by exact name. */
export function reconcileCollectionMenus(
  value: MenuPreferences,
  rows: readonly SavedCollection[],
): MenuPreferences {
  const collections = { ...value.collections },
    collectionIds = { ...value.collectionIds },
    labels = { ...value.labels };
  let changed = false;
  for (const key of value.order) {
    if (!isCollectionMenuId(key)) continue;
    const id = collectionIds[key];
    const row = id
      ? rows.find((row) => row.id === id)
      : rows.find((row) => row.name === collections[key]);
    if (!row) continue;
    if (
      collections[key] !== row.name ||
      collectionIds[key] !== row.id ||
      labels[key] !== undefined
    ) {
      collections[key] = row.name;
      collectionIds[key] = row.id;
      delete labels[key];
      changed = true;
    }
  }
  return changed ? { ...value, collections, collectionIds, labels } : value;
}
