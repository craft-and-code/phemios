import type { AccountSession } from "./server";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import { parseLabelDetail } from "./labels";
import { referenceSource } from "./sources";
/** Admit only the edition's explicit, bounded, same-origin label associations. */
export function albumLabelReferences(raw: unknown, reference: string): string[] {
  const row = raw as { reference?: unknown; labels?: unknown };
  if (
    !row ||
    row.reference !== reference ||
    !Array.isArray(row.labels) ||
    row.labels.length > 64 ||
    row.labels.some(
      (value) =>
        typeof value !== "string" ||
        !value.startsWith("label:") ||
        referenceSource(value) !== referenceSource(reference),
    ) ||
    new Set(row.labels).size !== row.labels.length
  )
    throw new Error(t("Label Aède invalide."));
  return row.labels as string[];
}
/** Existing catalogue detail reads resolve display names; no external enrichment or raw-tag guesses. */
export async function albumLabels(
  reference: string,
  admission?: { owner: AccountSession; current: () => boolean },
) {
  if (admission && !admission.current()) return [];
  const raw = await requestAede(
    "/api/v1/album",
    { ref: reference },
    "GET",
    null,
    referenceSource(reference),
    admission?.owner,
  );
  if (admission && !admission.current()) return [];
  const result: { reference: string; name: string }[] = [];
  for (const ref of albumLabelReferences(raw, reference)) {
    if (admission && !admission.current()) return [];
    const raw = await requestAede(
      "/api/v1/label",
      { ref },
      "GET",
      null,
      referenceSource(reference),
      admission?.owner,
    );
    if (admission && !admission.current()) return [];
    const label = parseLabelDetail(raw, ref);
    if (!label.releases.includes(reference)) throw new Error(t("Label Aède invalide."));
    result.push({ reference: label.reference, name: label.name });
  }
  return result;
}
