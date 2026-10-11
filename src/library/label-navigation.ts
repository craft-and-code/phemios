import { t } from "../i18n";
import { parseLabelDetail } from "./labels";
import { referenceSource, type SourceId } from "./sources";
import { normalizeName } from "./filtering";
/** Aède resolves names and ambiguity; the client admits only its exact same-origin label identity. */
export function labelDestination(raw: unknown, name: string, source: SourceId): string {
  const row = raw as { reference?: unknown };
  if (
    !row ||
    typeof row.reference !== "string" ||
    !row.reference.startsWith("label:") ||
    referenceSource(row.reference) !== source
  )
    throw new Error(t("Label Aède invalide."));
  const label = parseLabelDetail(raw, row.reference);
  if (normalizeName(label.name) !== normalizeName(name)) throw new Error(t("Label Aède invalide."));
  return `#/label/${encodeURIComponent(label.reference)}`;
}
