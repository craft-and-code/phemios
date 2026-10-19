import { createDiagnosticRead } from "./diagnostic-read";
import { createEffect, createSignal, on, onCleanup, type Accessor } from "solid-js";
import { t } from "../i18n";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import { parseM3UDetail, parseM3UPage, type M3UKind } from "./m3u-files";
export interface M3UScope {
  session: AccountSession;
  source: SourceId;
  kind: M3UKind;
  offset: number;
  query: string;
}
type Request = (path: string, query: Record<string, string>, source: SourceId) => Promise<unknown>;
function same(a: M3UScope | undefined, b: M3UScope | undefined) {
  return (
    !!a &&
    !!b &&
    a.session === b.session &&
    a.source === b.source &&
    a.kind === b.kind &&
    a.offset === b.offset &&
    a.query === b.query
  );
}
/** Resolved failures keep recovery controls mounted; owner/category/page changes hide retained details immediately. */
export function createM3UBrowser(scope: Accessor<M3UScope | undefined>, request: Request) {
  let disposed = false;
  onCleanup(() => {
    disposed = true;
    capability = undefined;
  });
  const [selection, setSelection] = createSignal<{ scope: M3UScope; id: string }>();
  let capability:
    { session: AccountSession; source: SourceId; promise: Promise<boolean> } | undefined;
  function supported(input: M3UScope) {
    if (capability?.session !== input.session || capability.source !== input.source) {
      const promise = request("/api/v1/status", {}, input.source).then((value) => {
        const raw = value as { capabilities?: unknown };
        return Array.isArray(raw?.capabilities) && raw.capabilities.includes("library_m3u_files");
      });
      const retained = { session: input.session, source: input.source, promise };
      capability = retained;
      void promise.catch(() => {
        if (capability === retained) capability = undefined;
      });
    }
    return capability.promise;
  }
  const path = (kind: M3UKind) => (kind === "files" ? "/api/me/v1/m3u-files" : "/api/me/v1/m3u");
  const pages = createDiagnosticRead(
    () => scope() ?? false,
    async (input, admission) => {
      try {
        const modern = await supported(input);
        if (disposed || !admission.current() || !same(input, scope())) return { input };
        if (!modern && (input.kind === "files" || input.query))
          throw Error(
            t(
              "Mettez à jour puis redémarrez Aède pour parcourir les fichiers M3U de vos dossiers.",
            ),
          );
        const data = parseM3UPage(
          await request(
            path(input.kind),
            {
              offset: String(input.offset),
              limit: "50",
              ...(input.query ? { q: input.query } : {}),
            },
            input.source,
          ),
          input.offset,
          input.kind,
        );
        return { input, data };
      } catch (failure) {
        return { input, error: String(failure) };
      }
    },
  );
  const currentPage = () =>
    !disposed && same(pages.current()?.input, scope()) ? pages.current() : undefined;
  createEffect(on(scope, () => setSelection(undefined), { defer: true }));
  const activeSelection = () =>
    !disposed && same(selection()?.scope, scope()) ? selection() : undefined;
  const details = createDiagnosticRead(
    () => activeSelection() ?? false,
    async (input) => {
      try {
        const file = parseM3UDetail(
          await request(`${path(input.scope.kind)}/${input.id}`, {}, input.scope.source),
          input.id,
          input.scope.kind,
        );
        return { input, file: { ...file, source: input.scope.source } };
      } catch (failure) {
        return { input, error: String(failure) };
      }
    },
  );
  const currentDetail = () =>
    details.current()?.input === activeSelection() ? details.current() : undefined;
  return {
    page: () => currentPage()?.data,
    error: () => currentPage()?.error ?? "",
    loading: () => !disposed && !!scope() && pages.loading() && !currentPage()?.data,
    refreshing: () => !disposed && !!scope() && pages.loading(),
    selected: () => activeSelection()?.id ?? "",
    select: (id: string) => {
      const input = scope();
      if (!disposed && input && currentPage()?.data?.items.some((row) => row.id === id))
        setSelection({ scope: input, id });
    },
    detail: () => currentDetail()?.file,
    detailError: () => currentDetail()?.error ?? "",
    detailLoading: () => !!activeSelection() && details.loading(),
    /** A delayed download may acknowledge only the exact selection that started it. */
    captureFile(input: M3UScope, id: string) {
      const held = activeSelection();
      return () =>
        !disposed &&
        input === scope() &&
        held !== undefined &&
        held === activeSelection() &&
        held.id === id;
    },
    refetch: () => {
      capability = undefined;
      return pages.refetch();
    },
    retryDetail: details.refetch,
    pending: () => pages.pending() || details.pending(),
    cancel() {
      pages.cancel();
      details.cancel();
    },
  };
}
