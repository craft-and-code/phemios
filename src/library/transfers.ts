import type { PlayableSelection } from "./playback-selection";
import { t } from "../i18n";
export interface TransferOptions {
  format: "original" | "mp3" | "aac" | "opus" | "flac" | "wav";
  verify: boolean;
  replace: boolean;
}
export interface TransferPreview {
  id: string;
  tracks: number;
  bytes: number;
  destination: string;
  ipod: boolean;
  files: string[];
}
export interface TransferStatus {
  phase: string;
  running: boolean;
  done?: number;
  total?: number;
  current?: string;
  file_bytes?: number;
  file_total?: number;
  error?: string;
}
/** Transfers are sets of source files; repeated queue occurrences must not copy/convert the same file again. */
export function addTransferSelection(
  existing: readonly PlayableSelection[],
  added: readonly PlayableSelection[],
): PlayableSelection[] {
  const rows = new Map(existing.map((row) => [row.reference, row]));
  for (const row of added) rows.set(row.reference, row);
  if (rows.size > 4096) throw Error(t("Sélection limitée à 4096 pistes."));
  return [...rows.values()];
}
/** Overall progress counts completed tracks plus the currently downloaded original, never a false completed copy. */
export function transferProgress(status: TransferStatus): number {
  if (!status.total || status.total <= 0) return 0;
  return Math.max(0, Math.min(1, (status.done ?? 0) / status.total));
}
export const transferPhases: Readonly<Record<string, string>> = {
  idle: "Aucun transfert en cours.",
  preparing: "Préparation du transfert…",
  downloading: "Récupération de l’original…",
  copying: "Copie et vérification…",
  ipod: "Mise à jour de l’iPod…",
  mtp: "Transfert MTP…",
  complete: "Transfert terminé.",
  failed: "Le transfert a échoué.",
  canceled: "Transfert arrêté.",
};
