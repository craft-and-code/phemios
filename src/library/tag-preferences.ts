import type { SourceId } from "./sources";
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
const scope = (session: AccountSession, source: SourceId) =>
  JSON.stringify([
    source === "local" ? "phemios-managed-local" : session.server,
    session.account.id,
  ]);
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
  source: SourceId = "server",
): readonly string[] {
  return session ? (entries.find((row) => row.scope === scope(session, source))?.tags ?? []) : [];
}
/** Saved suppression is reversible and changes autocomplete only. */
export function setTagExcluded(
  storage: Store,
  session: AccountSession,
  tag: string,
  excluded: boolean,
  source: SourceId = "server",
): Entry[] {
  const entries = readTagPreferences(storage),
    id = scope(session, source),
    tags = excludedTags(entries, session, source).filter(
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
/** Explicitly re-entered, successfully saved tags become suggestions again in this scope only. */
export function rememberEnteredTags(
  storage: Store,
  session: AccountSession,
  tags: readonly string[],
  source: SourceId = "server",
): Entry[] {
  const entries = readTagPreferences(storage),
    id = scope(session, source),
    entered = new Set(tags.map(normalizeName));
  const next = entries
    .map((row) =>
      row.scope === id
        ? { ...row, tags: row.tags.filter((tag) => !entered.has(normalizeName(tag))) }
        : row,
    )
    .filter((row) => row.tags.length);
  storage.setItem(key, JSON.stringify(next));
  return next;
}
export function suggestionVocabulary(
  vocabulary: readonly string[],
  entries: readonly Entry[],
  session: AccountSession | undefined,
  source: SourceId = "server",
): string[] {
  const excluded = new Set(excludedTags(entries, session, source).map(normalizeName));
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
    remember: (session: AccountSession, tags: readonly string[], source: SourceId = "server") => {
      try {
        setEntries(rememberEnteredTags(storage, session, tags, source));
        setError("");
      } catch (failure) {
        setError(String(failure));
      }
    },
    update: (
      session: AccountSession,
      tag: string,
      excluded: boolean,
      source: SourceId = "server",
    ) => {
      try {
        setEntries(setTagExcluded(storage, session, tag, excluded, source));
        setError("");
      } catch (failure) {
        setError(String(failure));
      }
    },
  };
}
