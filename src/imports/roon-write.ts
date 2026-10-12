import { t } from "../i18n";
import { parseAnnotationResponse } from "../library/annotation-loading";
import type { AnnotationPatch } from "../library/annotation-writes";
import type { Annotation } from "../library/server";
import { additiveImportPatch, type RoonRow } from "./roon-plan";
/** Serial explicit import; recheck current saved values and captured account before every mutation.
 * Confirmed rows stay saved after cancellation/failure. No request is retried automatically.
 */
export async function writeRoonImport(
  rows: readonly RoonRow[],
  ports: {
    active: () => boolean;
    cancelled?: () => boolean;
    read: (reference: string) => Promise<unknown>;
    write: (reference: string, patch: AnnotationPatch) => Promise<unknown>;
    publish: (reference: string, annotation: Annotation | null) => void;
    progress: (saved: number, skipped: number) => void;
  },
): Promise<{ saved: number; skipped: number; stopped: boolean }> {
  let saved = 0,
    skipped = 0;
  for (const row of rows) {
    if (row.status !== "ready" || !row.reference || !row.desired) continue;
    if (!ports.active() || ports.cancelled?.()) return { saved, skipped, stopped: true };
    const current = parseAnnotationResponse(await ports.read(row.reference), row.reference);
    if (!ports.active() || ports.cancelled?.()) return { saved, skipped, stopped: true };
    const patch = additiveImportPatch(row.desired, current);
    if (!patch || !Object.keys(patch).length) {
      skipped++;
      ports.progress(saved, skipped);
      continue;
    }
    const raw = await ports.write(row.reference, patch);
    if (!ports.active()) return { saved, skipped, stopped: true };
    const confirmed = parseAnnotationResponse(raw, row.reference);
    if (!confirmed) throw new Error(t("L’import n’a pas été confirmé par Aède."));
    ports.publish(row.reference, confirmed);
    saved++;
    ports.progress(saved, skipped);
  }
  return { saved, skipped, stopped: ports.cancelled?.() ?? false };
}
