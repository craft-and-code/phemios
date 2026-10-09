import { t } from "../i18n";
import { parseDiagnosis, type Page } from "./statistics";
export type Severity = "error" | "warning" | "info";
export interface DoctorIssue {
  type: string;
  label: string;
  severity: Severity;
  detail: string;
  files: string[];
  file_count: number;
  files_truncated: boolean;
}
/** Validate diagnostic pages before showing findings; no repair is implied by a diagnosis. */
export function parseDoctor(value: unknown, offset: number) {
  const diagnosis = parseDiagnosis(value);
  const raw = value as Record<string, unknown>;
  const count = (v: unknown): number => {
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0)
      throw new Error(t("Pagination Doctor invalide."));
    return v;
  };
  const total = count(raw.total),
    limit = count(raw.limit),
    scanned_at = count(raw.scanned_at);
  if (
    count(raw.offset) !== offset ||
    limit !== 50 ||
    !Array.isArray(raw.items) ||
    raw.items.length !== Math.min(limit, Math.max(0, total - offset))
  )
    throw new Error(t("Pagination Doctor incohérente."));
  const items: DoctorIssue[] = raw.items.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error(t("Diagnostic Doctor invalide."));
    const row = value as Record<string, unknown>;
    if (
      typeof row.type !== "string" ||
      typeof row.label !== "string" ||
      typeof row.detail !== "string" ||
      !["error", "warning", "info"].includes(String(row.severity)) ||
      typeof row.files_truncated !== "boolean" ||
      !Array.isArray(row.files) ||
      row.files.length > 20 ||
      row.files.some((file: unknown) => typeof file !== "string")
    )
      throw new Error(t("Diagnostic Doctor invalide."));
    const file_count = count(row.file_count);
    if (row.files.length !== Math.min(20, file_count) || row.files_truncated !== file_count > 20)
      throw new Error(t("Aperçu des fichiers Doctor incomplet."));
    return {
      type: row.type,
      label: row.label,
      detail: row.detail,
      severity: row.severity as Severity,
      files: row.files as string[],
      file_count,
      files_truncated: row.files_truncated,
    };
  });
  if (total !== diagnosis.summary.error + diagnosis.summary.warning + diagnosis.summary.info)
    throw new Error(t("Résumé Doctor incohérent."));
  const page: Page<DoctorIssue> = { items, total, limit, offset, scanned_at };
  return { ...diagnosis, ...page };
}
export const severityLabels: Record<Severity, string> = {
  error: "Erreurs",
  warning: "Avertissements",
  info: "Informations",
};
export const issueLabels: Record<string, string> = {
  missing_title: t("Titre manquant"),
  missing_artist: t("Artiste manquant"),
  missing_album: t("Album manquant"),
  missing_date: t("Année manquante"),
  missing_track_number: t("Numéro de piste manquant"),
  missing_duration: t("Durée manquante"),
  duplicate_track: t("Pistes potentiellement en double"),
  same_audio: t("Audio identique"),
  duplicate_album: t("Albums potentiellement en double"),
  other_edition: t("Autre édition"),
  md5_mismatch: t("MD5 audio différent"),
  incomplete_album: t("Album incomplet"),
  mixed_quality: t("Formats hétérogènes"),
  missing_cover: t("Pochette manquante"),
  suspicious_year: t("Année suspecte"),
  damaged_audio: t("Audio endommagé"),
  same_artist_maybe: t("Artistes potentiellement identiques"),
  source_disagrees: t("Désaccord avec les données locales"),
  sources_disagree: t("Désaccord entre sources"),
  source_needs_review: t("Source à examiner"),
  source_identity_conflict: t("Identité de source en conflit"),
  incomplete_source_credits: t("Crédits de source incomplets"),
  orphaned_relation_annotation: t("Annotation de relation sans correspondance"),
};
