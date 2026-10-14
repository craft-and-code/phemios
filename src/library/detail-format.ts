import { locale } from "../i18n";
/** Decimal file sizes match Finder; unknown facts never become zero. */
export function fileSize(bytes: number): string {
  const units = locale() === "en" ? ["B", "KB", "MB", "GB", "TB"] : ["o", "Ko", "Mo", "Go", "To"];
  let value = bytes,
    index = 0;
  while (value >= 1000 && index < units.length - 1) {
    value /= 1000;
    index++;
  }
  const digits = index > 1 && value < 100 ? 1 : 0;
  return `${value.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[index]}`;
}
/** Use FlacCompagnon's rounded minute/second clock for a singular track. */
export function trackDuration(ms: number | null): string {
  if (ms === null) return locale() === "en" ? "Unknown" : "Inconnue";
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Unknown collection aggregates stay blank; confirmed milliseconds retain the existing truncated clock. */
export function collectionDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isSafeInteger(ms) || ms < 0) return "";
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
