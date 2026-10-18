import { t } from "../i18n";
/** Native budget is device-wide; removing a key never resets these counters. */
export interface ConcertConfig {
  ready: boolean;
  limit: number;
  used: number;
  remaining: number;
  resetAt: number | null;
}
/** Refuse inconsistent or unbounded IPC counters before enabling paid-provider search controls. */
export function concertConfig(raw: unknown): ConcertConfig {
  const v = raw as ConcertConfig;
  if (
    !v ||
    typeof v.ready !== "boolean" ||
    v.limit !== 1000 ||
    !Number.isSafeInteger(v.used) ||
    v.used < 0 ||
    v.used > 1000 ||
    v.remaining !== 1000 - v.used ||
    !(v.resetAt === null || (Number.isSafeInteger(v.resetAt) && v.resetAt >= 0))
  )
    throw new Error(t("Budget JamBase invalide."));
  return v;
}
