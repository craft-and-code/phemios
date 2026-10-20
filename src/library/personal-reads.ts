import { retryAedeReadOnRecovery } from "./aede-availability";
import { t } from "../i18n";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
  type Accessor,
} from "solid-js";
import type { Section } from "../navigation/routes";
import type { AccountSession } from "./server";
interface Page {
  items: unknown[];
  total: number;
}
export interface HistoryRow {
  track: string;
  at: number;
  ms_played: number | null;
  completed: boolean | null;
  title: string;
  release: string | null;
  error?: string;
}
type Request = (
  path: string,
  query: Record<string, string>,
  owner: AccountSession,
) => Promise<unknown>;
/** Reads resolve to data or an explicit error; rejected resources never break shell navigation. */
export function createPersonalReads(
  section: Accessor<Section>,
  session: Accessor<AccountSession | undefined>,
  offset: Accessor<number>,
  request: Request,
) {
  const scope = createMemo(() => {
    const path = (
      {
        collections: "/api/me/v1/collections",
        history: "/api/me/v1/history",
        playlists: "/api/me/v1/m3u",
      } as Partial<Record<Section, string>>
    )[section()];
    const account = session();
    return account && path ? { path, account, offset: offset() } : false;
  });
  type Scope = Exclude<ReturnType<typeof scope>, false>;
  const [page, setPage] = createSignal<{ scope: Scope; data?: Page; error?: string }>();
  const [resolved, setResolved] = createSignal<{ scope: Scope; rows: HistoryRow[] }>();
  const [pending, setPending] = createSignal(false);
  let serial = 0,
    disposed = false;
  const same = (a: Scope | undefined, b: Scope | false) => !!a && a === b;
  const currentPage = () => (!disposed && same(page()?.scope, scope()) ? page() : undefined);
  async function refetch() {
    const input = scope();
    if (!input || disposed || pending()) return;
    const ticket = ++serial;
    const current = () => !disposed && ticket === serial && same(input, scope());
    setPending(true);
    try {
      const value = (await request(
        input.path,
        {
          offset: String(input.offset),
          limit: "50",
        },
        input.account,
      )) as Page;
      if (!current()) return;
      if (
        !value ||
        !Array.isArray(value.items) ||
        value.items.length > 50 ||
        !Number.isSafeInteger(value.total) ||
        value.total < value.items.length
      )
        throw new Error(t("Page Aède invalide."));
      if (input.path.endsWith("/history")) {
        for (const row of value.items) {
          const item = row as HistoryRow;
          if (
            !item ||
            typeof item.track !== "string" ||
            !Number.isSafeInteger(item.at) ||
            item.at < 0 ||
            !(
              item.ms_played === null ||
              (Number.isSafeInteger(item.ms_played) && item.ms_played >= 0)
            ) ||
            !(item.completed === null || typeof item.completed === "boolean")
          )
            throw new Error(t("Historique Aède invalide."));
        }
        const old = same(resolved()?.scope, input) ? (resolved()?.rows ?? []) : [];
        const names = new Map(old.filter((row) => !row.error).map((row) => [row.track, row]));
        const rows: HistoryRow[] = [];
        for (const item of value.items as HistoryRow[]) {
          if (!current()) return;
          let row = old.find(
            (row) =>
              row.track === item.track &&
              row.at === item.at &&
              row.ms_played === item.ms_played &&
              row.completed === item.completed &&
              !row.error,
          );
          if (!row) {
            try {
              const track =
                names.get(item.track) ??
                ((await request("/api/v1/track", { ref: item.track }, input.account)) as {
                  title: string;
                  release: string | null;
                });
              if (!current()) return;
              if (
                !track ||
                typeof track.title !== "string" ||
                !(track.release === null || typeof track.release === "string")
              )
                throw new Error(t("Piste Aède invalide."));
              row = { ...item, title: track.title, release: track.release };
              names.set(item.track, row);
            } catch (error) {
              row = {
                ...item,
                title: t("Piste indisponible"),
                release: null,
                error: String(error),
              };
            }
          }
          rows.push(row);
        }
        if (!current()) return;
        // Preserve row identities and the DOM, even when the newest visit is inserted.
        if (rows.length !== old.length || rows.some((row, i) => row !== old[i]))
          setResolved({ scope: input, rows });
        else if (!same(resolved()?.scope, input)) setResolved({ scope: input, rows });
      }
      if (JSON.stringify(currentPage()?.data) !== JSON.stringify(value) || currentPage()?.error)
        setPage({ scope: input, data: value });
    } catch (error) {
      if (current())
        setPage({
          scope: input,
          ...(currentPage()?.data ? { data: currentPage()!.data! } : {}),
          error: error instanceof Error ? error.message : String(error),
        });
    } finally {
      if (current()) setPending(false);
    }
  }
  createEffect(() => {
    const active = scope();
    serial++;
    setPending(false);
    if (active) untrack(() => void refetch());
    if (!active || section() !== "history") return;
    const timer = setInterval(() => {
      void refetch();
    }, 2000);
    onCleanup(() => clearInterval(timer));
  });
  onCleanup(() => {
    disposed = true;
    serial++;
  });

  retryAedeReadOnRecovery(() => currentPage()?.error, refetch);
  return {
    page: currentPage,
    history: () =>
      !disposed && section() === "history" && same(resolved()?.scope, scope())
        ? resolved()!.rows
        : [],
    loading: () => !!scope() && pending() && !currentPage()?.data,
    refetch,
  };
}
