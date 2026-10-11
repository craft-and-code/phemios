import { t } from "../i18n";
import type { AccountSession, Annotation } from "./server";
import { referenceSource, type SourceId } from "./sources";
interface Options {
  session: (source: SourceId) => AccountSession | undefined;
  request: (source: SourceId, offset: number) => Promise<unknown>;
  clear: (source: SourceId) => void;
  publish: (source: SourceId, rows: readonly Annotation[]) => void;
  error: (failure: string) => void;
}
/** Validate private rows without interpreting note markup or fabricating absent ratings. */
export function parseAnnotation(raw: unknown, reference?: string): Annotation {
  const row = raw as Annotation;
  if (
    !row ||
    typeof row !== "object" ||
    Array.isArray(row) ||
    typeof row.reference !== "string" ||
    !/^(artist|release|track):.+/.test(row.reference) ||
    (reference !== undefined && row.reference !== reference) ||
    typeof row.loved !== "boolean" ||
    !(
      row.rating === null ||
      (Number.isInteger(row.rating) && row.rating >= 1 && row.rating <= 5)
    ) ||
    !(row.note === null || typeof row.note === "string") ||
    !Array.isArray(row.tags) ||
    row.tags.some((tag) => typeof tag !== "string")
  )
    throw new Error(t("Annotations illisibles :"));
  return row;
}
/** Complete source snapshots are published only for the captured session/read generation.
 * Reset clears that source immediately; another source's private rows remain untouched.
 * Paging has a 1M-row / 100 MiB serialized bound and preserves confirmed concurrent edits.
 */
export function createAnnotationLoader(options: Options) {
  const epochs: Record<SourceId, number> = { local: 0, server: 0 },
    edits: Record<SourceId, Map<string, Annotation | null> | undefined> = {
      local: undefined,
      server: undefined,
    };
  let disposed = false;
  async function load(source: SourceId): Promise<void> {
    const session = options.session(source),
      ticket = ++epochs[source],
      current = () => !disposed && epochs[source] === ticket && options.session(source) === session;
    if (!session || disposed) return;
    const rows = new Map<string, Annotation>(),
      edited = new Map<string, Annotation | null>();
    edits[source] = edited;
    let offset = 0,
      total: number | undefined,
      scannedAt: number | undefined,
      bytes = 0;
    try {
      while (current()) {
        const raw = await options.request(source, offset);
        if (!current()) return;
        const page = raw as {
          items: unknown[];
          total: number;
          offset: number;
          limit: number;
          scanned_at: number;
        };
        if (
          !page ||
          !Array.isArray(page.items) ||
          page.items.length > 200 ||
          !Number.isSafeInteger(page.total) ||
          page.total < offset + page.items.length ||
          page.total > 1000000 ||
          page.offset !== offset ||
          page.limit !== 200 ||
          !Number.isSafeInteger(page.scanned_at) ||
          page.scanned_at < 0 ||
          (total !== undefined && page.total !== total) ||
          (scannedAt !== undefined && page.scanned_at !== scannedAt)
        )
          throw new Error(t("Pagination des annotations incohérente."));
        total = page.total;
        scannedAt = page.scanned_at;
        bytes += new TextEncoder().encode(JSON.stringify(page.items)).byteLength;
        if (bytes > 100 * 1024 * 1024) throw new Error(t("Annotations illisibles :"));
        for (const value of page.items) {
          const row = parseAnnotation(value);
          if (referenceSource(row.reference) !== source || rows.has(row.reference))
            throw new Error(t("Pagination des annotations incohérente."));
          rows.set(row.reference, row);
        }
        offset += page.items.length;
        if (offset === total) {
          for (const [reference, row] of edited) {
            if (row === null) rows.delete(reference);
            else rows.set(reference, row);
          }
          options.clear(source);
          options.publish(source, [...rows.values()]);
          return;
        }
        if (!page.items.length) throw new Error(t("Pagination des annotations incohérente."));
      }
    } catch (failure) {
      if (current())
        options.error(failure instanceof Error ? failure.message : t("Annotations indisponibles."));
    } finally {
      if (epochs[source] === ticket) edits[source] = undefined;
    }
  }
  return {
    load,
    reset(source: SourceId) {
      epochs[source]++;
      edits[source] = undefined;
      options.clear(source);
    },
    updated(reference: string, row: Annotation | null) {
      edits[referenceSource(reference)]?.set(reference, row);
    },
    dispose() {
      disposed = true;
      epochs.local++;
      epochs.server++;
    },
  };
}
