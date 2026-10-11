import { t } from "../i18n";
import { createEffect, createMemo, createResource, onCleanup, type Accessor } from "solid-js";
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
type Request = (path: string, query: Record<string, string>) => Promise<unknown>;
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
  const [page, { refetch }] = createResource(
    scope,
    async (input, info): Promise<{ scope: typeof input; data?: Page; error?: string }> => {
      try {
        const value = (await request(input.path, {
          offset: String(input.offset),
          limit: "50",
        })) as Page;
        if (
          !value ||
          !Array.isArray(value.items) ||
          value.items.length > 50 ||
          !Number.isSafeInteger(value.total) ||
          value.total < value.items.length
        )
          throw new Error(t("Page Aède invalide."));
        if (input.path.endsWith("/history"))
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
        if (
          info.value?.scope.account === input.account &&
          info.value.scope.path === input.path &&
          info.value.scope.offset === input.offset &&
          JSON.stringify(info.value.data) === JSON.stringify(value)
        )
          return info.value;
        return { scope: input, data: value };
      } catch (error) {
        return { scope: input, error: error instanceof Error ? error.message : String(error) };
      }
    },
  );
  const currentPage = () => {
    const active = scope(),
      result = page();
    return active &&
      result?.scope.account === active.account &&
      result.scope.path === active.path &&
      result.scope.offset === active.offset
      ? result
      : undefined;
  };
  const [history] = createResource(
    () => (section() === "history" && currentPage()?.data ? currentPage() : undefined),
    async (value) => {
      const result: HistoryRow[] = [];
      for (const row of value.data!.items as HistoryRow[]) {
        try {
          const track = (await request("/api/v1/track", { ref: row.track })) as {
            title: string;
            release: string | null;
          };
          if (
            !track ||
            typeof track.title !== "string" ||
            !(track.release === null || typeof track.release === "string")
          )
            throw new Error(t("Piste Aède invalide."));
          result.push({ ...row, title: track.title, release: track.release });
        } catch (error) {
          result.push({
            ...row,
            title: t("Piste indisponible"),
            release: null,
            error: String(error),
          });
        }
      }
      return { scope: value.scope, rows: result };
    },
  );
  createEffect(() => {
    const active = scope();
    if (!active || section() !== "history") return;
    // Serialize bounded account reads; unchanged pages retain their resolved track names.
    const timer = setInterval(() => {
      if (!page.loading && !history.loading) void refetch();
    }, 2000);
    onCleanup(() => clearInterval(timer));
  });
  return {
    page: currentPage,
    history: () => {
      const result = history(),
        active = scope();
      return section() === "history" &&
        active &&
        result?.scope.account === active.account &&
        result.scope.offset === active.offset
        ? result.rows
        : [];
    },
    loading: () => !!scope() && (page.loading || (section() === "history" && history.loading)),
    refetch,
  };
}
