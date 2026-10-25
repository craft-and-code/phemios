import { createMemo, createSignal, onCleanup } from "solid-js";
import { createDiagnosticRead } from "./diagnostic-read";
import { requestAede } from "../platform/desktop";
import {
  validCollectionName,
  validCollectionId,
  type SavedCollection,
} from "../navigation/collection-menu";
import { t } from "../i18n";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
export interface CollectionMenuScope {
  session: AccountSession;
  source: SourceId;
}
/** Read every bounded page from one captured owner, retaining names only. */
export async function readSavedCollections(
  source: SourceId,
  session: AccountSession,
  current: () => boolean,
): Promise<SavedCollection[] | undefined> {
  const rows: SavedCollection[] = [],
    ids = new Set<string>(),
    seen = new Set<string>();
  let total: number | undefined, epoch: number | undefined;
  for (let offset = 0; total === undefined || offset < total; offset += 50) {
    if (!current()) return;
    const raw = await requestAede<unknown>(
      "/api/me/v1/collections",
      { offset: String(offset), limit: "50" },
      "GET",
      null,
      source,
      session,
    );
    if (!current()) return;
    const row = raw as {
      items?: unknown;
      total?: unknown;
      offset?: unknown;
      limit?: unknown;
      scanned_at?: unknown;
    };
    if (
      !row ||
      !Array.isArray(row.items) ||
      !Number.isSafeInteger(row.total) ||
      (row.total as number) < 0 ||
      (row.total as number) > 4096 ||
      row.offset !== offset ||
      row.limit !== 50 ||
      !Number.isSafeInteger(row.scanned_at) ||
      (row.scanned_at as number) < 0 ||
      row.items.length !== Math.min(50, (row.total as number) - offset) ||
      (total !== undefined && total !== row.total) ||
      (epoch !== undefined && epoch !== row.scanned_at)
    )
      throw new Error(t("Liste des collections invalide ou modifiée ; actualisez-la."));
    total = row.total as number;
    epoch = row.scanned_at as number;
    for (const item of row.items) {
      const name = (item as { name?: unknown })?.name;
      const id = (item as { id?: unknown })?.id;
      if (!validCollectionId(id))
        throw new Error(
          t("Mettez à jour puis redémarrez Aède pour utiliser les identifiants des collections."),
        );
      if (!validCollectionName(name) || seen.has(name) || ids.has(id))
        throw new Error(t("Liste des collections invalide ou modifiée ; actualisez-la."));
      seen.add(name);
      ids.add(id);
      rows.push({ id, name });
    }
  }
  return rows;
}
/** Compatibility projection used by name-only callers. */
export async function readCollectionMenuChoices(
  source: SourceId,
  session: AccountSession,
  current: () => boolean,
) {
  return (await readSavedCollections(source, session, current))?.map((row) => row.name);
}
/** Explicit settings reads discard late answers after changing account, source or tab. */
export function createCollectionMenuChoices(scope: () => CollectionMenuScope | false) {
  const held = createMemo(scope);
  const [revision, setRevision] = createSignal(0);
  const readScope = createMemo(() => {
    const owner = held();
    revision();
    return owner ? { ...owner } : false;
  });
  // A rename must retire an older in-flight listing instead of dropping its
  // invalidation while a read is pending. The owner identity remains stable.
  const refresh = () => {
    setRevision((value) => value + 1);
  };
  const read = createDiagnosticRead(readScope, (key, admission) =>
    readSavedCollections(key.source, key.session, admission.current),
  );
  if (typeof window !== "undefined") {
    const invalidate = () => {
      refresh();
    };
    window.addEventListener("focus", invalidate);
    window.addEventListener("phemios-collections-changed", invalidate);
    onCleanup(() => {
      window.removeEventListener("focus", invalidate);
      window.removeEventListener("phemios-collections-changed", invalidate);
    });
  }
  return {
    rows: () => read.current() ?? [],
    identity: held,
    names: () => (read.current() ?? []).map((row) => row.name),
    loading: read.loading,
    error: read.error,
    refresh,
  };
}
