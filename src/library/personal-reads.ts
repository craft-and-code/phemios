import { t } from "../i18n";
import { createMemo, createResource, type Accessor } from "solid-js";
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
    async (input): Promise<{ data?: Page; error?: string }> => {
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
        return { data: value };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  );
  const [history] = createResource(
    () =>
      section() === "history" && scope() && !page.loading && !page.error ? page()?.data : undefined,
    async (value): Promise<HistoryRow[]> => {
      const result: HistoryRow[] = [];
      for (const row of value.items as HistoryRow[]) {
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
      return result;
    },
  );
  return {
    page: () => (scope() ? page() : undefined),
    history: () => (section() === "history" && scope() ? (history() ?? []) : []),
    loading: () => !!scope() && (page.loading || (section() === "history" && history.loading)),
    refetch,
  };
}
