import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import type { AccountSession } from "../library/server";
import type { SourceId } from "../library/sources";
import { wikipediaArticle, type WikipediaArticle } from "./wikipedia";
interface Api {
  read(source: SourceId, owner: AccountSession): Promise<unknown>;
  update(
    action: "save" | "remove",
    payload: unknown,
    source: SourceId,
    owner: AccountSession,
  ): Promise<unknown>;
}
/** Shared admission for native saved copies and explicit portable backup records. */
export function parseAccountArticles(raw: unknown): WikipediaArticle[] {
  const value = raw as { version?: unknown; articles?: unknown };
  if (!value || value.version !== 1 || !Array.isArray(value.articles) || value.articles.length > 40)
    throw new Error(t("Articles enregistrés illisibles."));
  // Match the native persisted array's budget, excluding the response envelope.
  if (new TextEncoder().encode(JSON.stringify(value.articles)).byteLength > 3 * 1024 * 1024)
    throw new Error(
      t("Stockage des articles plein. Retirez une copie pour en enregistrer une autre."),
    );
  const rows = value.articles.map(wikipediaArticle);
  if (rows.some((row) => new TextEncoder().encode(row.text).byteLength > 512 * 1024))
    throw new Error(t("Articles enregistrés illisibles."));
  if (new Set(rows.map((row) => `${row.language}:${row.pageId}`)).size !== rows.length)
    throw new Error(t("Articles enregistrés illisibles."));
  return rows;
}
/** Private copies use native exact-session admission, never the old device-wide localStorage document. */
export function createAccountSavedArticles(
  session: () => AccountSession | undefined,
  source: () => SourceId,
  api: Api,
) {
  const scope = createMemo(() => {
    const owner = session();
    return owner ? { owner, source: source() } : undefined;
  });
  type Scope = NonNullable<ReturnType<typeof scope>>;
  const [snapshot, setSnapshot] = createSignal<{ scope: Scope; rows: WikipediaArticle[] }>(),
    [failure, setFailure] = createSignal<{ scope: Scope; message: string }>(),
    [loading, setLoading] = createSignal(false),
    [pending, setPending] = createSignal(false);
  let alive = true,
    tail: Promise<unknown> = Promise.resolve();
  const current = (held: Scope | undefined) => alive && !!held && scope() === held;
  const rows = () => (current(snapshot()?.scope) ? snapshot()!.rows : []);
  createEffect(() => {
    const held = scope();
    setFailure(undefined);
    setLoading(!!held);
    setPending(false);
    if (!held) return;
    void api
      .read(held.source, held.owner)
      .then((raw) => {
        if (current(held)) setSnapshot({ scope: held, rows: parseAccountArticles(raw) });
      })
      .catch((error) => {
        if (current(held)) setFailure({ scope: held, message: String(error) });
      })
      .finally(() => {
        if (current(held)) setLoading(false);
      });
  });
  onCleanup(() => {
    alive = false;
  });
  async function update(action: "save" | "remove", payload: unknown) {
    const held = scope();
    if (
      !held ||
      loading() ||
      !current(snapshot()?.scope) ||
      !["user", "admin"].includes(held.owner.account.role)
    )
      return false;
    const work = tail.then(async () => {
      if (!current(held)) return false;
      setPending(true);
      setFailure(undefined);
      try {
        const raw = await api.update(action, payload, held.source, held.owner);
        if (!current(held)) return false;
        setSnapshot({ scope: held, rows: parseAccountArticles(raw) });
        return true;
      } catch (error) {
        if (current(held)) setFailure({ scope: held, message: String(error) });
        return false;
      } finally {
        if (current(held)) setPending(false);
      }
    });
    tail = work;
    return work;
  }
  return {
    rows,
    loading,
    pending,
    error: () => (current(failure()?.scope) ? failure()!.message : ""),
    available: () => !!session(),
    writable: () =>
      current(snapshot()?.scope) &&
      !loading() &&
      !pending() &&
      ["user", "admin"].includes(session()?.account.role ?? ""),
    save: (row: WikipediaArticle) => update("save", wikipediaArticle(row)),
    remove: (row: WikipediaArticle) =>
      update("remove", { language: row.language, pageId: row.pageId }),
  };
}
