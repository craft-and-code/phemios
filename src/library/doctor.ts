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
      throw new Error("Pagination Doctor invalide.");
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
    throw new Error("Pagination Doctor incohérente.");
  const items: DoctorIssue[] = raw.items.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("Diagnostic Doctor invalide.");
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
      throw new Error("Diagnostic Doctor invalide.");
    const file_count = count(row.file_count);
    if (row.files.length !== Math.min(20, file_count) || row.files_truncated !== file_count > 20)
      throw new Error("Aperçu des fichiers Doctor incomplet.");
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
    throw new Error("Résumé Doctor incohérent.");
  const page: Page<DoctorIssue> = { items, total, limit, offset, scanned_at };
  return { ...diagnosis, ...page };
}
export const severityLabels: Record<Severity, string> = {
  error: "Erreurs",
  warning: "Avertissements",
  info: "Informations",
};
export const issueLabels: Record<string, string> = {
  missing_title: "Titre manquant",
  missing_artist: "Artiste manquant",
  missing_album: "Album manquant",
  missing_date: "Année manquante",
  missing_track_number: "Numéro de piste manquant",
  missing_duration: "Durée manquante",
  duplicate_track: "Pistes potentiellement en double",
  same_audio: "Audio identique",
  duplicate_album: "Albums potentiellement en double",
  other_edition: "Autre édition",
  md5_mismatch: "MD5 audio différent",
  incomplete_album: "Album incomplet",
  mixed_quality: "Formats hétérogènes",
  missing_cover: "Pochette manquante",
  suspicious_year: "Année suspecte",
  damaged_audio: "Audio endommagé",
  same_artist_maybe: "Artistes potentiellement identiques",
  source_disagrees: "Désaccord avec les données locales",
  sources_disagree: "Désaccord entre sources",
  source_needs_review: "Source à examiner",
  source_identity_conflict: "Identité de source en conflit",
  incomplete_source_credits: "Crédits de source incomplets",
  orphaned_relation_annotation: "Annotation de relation sans correspondance",
};
