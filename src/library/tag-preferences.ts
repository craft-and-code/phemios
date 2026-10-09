import { createSignal } from "solid-js";
import { normalizeName } from "./filtering";
import { t } from "../i18n";
import type { AccountSession } from "./server";
type Store = Pick<Storage, "getItem" | "setItem">;
interface Entry {
  scope: string;
  tags: string[];
}
const key = "phemios.tag-suggestions.v1";
const scope = (session: AccountSession) => JSON.stringify([session.server, session.account.id]);
/** Excluded suggestions never remove annotations; partitions retain authority and account identity. */
export function readTagPreferences(storage: Pick<Storage, "getItem">): Entry[] {
  const raw = storage.getItem(key);
  if (raw === null) return [];
  if (raw.length > 262144) throw new Error(t("Préférences de tags illisibles."));
  const entries: unknown = JSON.parse(raw);
  if (
    !Array.isArray(entries) ||
    entries.length > 128 ||
    entries.some(
      (row) =>
        !row ||
        typeof row.scope !== "string" ||
        !Array.isArray(row.tags) ||
        row.tags.length > 4096 ||
        row.tags.some((tag: unknown) => typeof tag !== "string" || !tag.trim() || tag.length > 256),
    )
  )
    throw new Error(t("Préférences de tags illisibles."));
  return entries as Entry[];
}
export function excludedTags(
  entries: readonly Entry[],
  session: AccountSession | undefined,
): readonly string[] {
  return session ? (entries.find((row) => row.scope === scope(session))?.tags ?? []) : [];
}
/** Saved suppression is reversible and changes autocomplete only. */
export function setTagExcluded(
  storage: Store,
  session: AccountSession,
  tag: string,
  excluded: boolean,
): Entry[] {
  const entries = readTagPreferences(storage),
    id = scope(session),
    tags = excludedTags(entries, session).filter(
      (value) => normalizeName(value) !== normalizeName(tag),
    );
  if (excluded) tags.push(tag.trim());
  const next = entries.filter((row) => row.scope !== id);
  if (tags.length) next.push({ scope: id, tags });
  const encoded = JSON.stringify(next);
  readTagPreferences({ getItem: () => encoded });
  storage.setItem(key, encoded);
  return next;
}
export function suggestionVocabulary(
  vocabulary: readonly string[],
  entries: readonly Entry[],
  session: AccountSession | undefined,
): string[] {
  const excluded = new Set(excludedTags(entries, session).map(normalizeName));
  return vocabulary.filter((tag) => !excluded.has(normalizeName(tag)));
}
/** Failed storage writes leave the previous confirmed vocabulary intact. */
export function createTagPreferences(storage: Store = localStorage) {
  const [entries, setEntries] = createSignal<Entry[]>([]),
    [error, setError] = createSignal("");
  try {
    setEntries(readTagPreferences(storage));
  } catch (failure) {
    setError(String(failure));
  }
  return {
    entries,
    error,
    update: (session: AccountSession, tag: string, excluded: boolean) => {
      try {
        setEntries(setTagExcluded(storage, session, tag, excluded));
        setError("");
      } catch (failure) {
        setError(String(failure));
      }
    },
  };
}
