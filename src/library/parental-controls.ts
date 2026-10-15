import { t } from "../i18n";
/** Server-owned civil-time windows use Monday=0; overnight windows are split across days. */
export interface ParentalDay {
  windows: { start_minute: number; end_minute: number }[];
  limit_seconds: number | null;
}
/** Parental policies never participate in child-editable interface preferences or backups. */
export interface ParentalPolicy {
  enabled: boolean;
  timezone: string;
  blocked_artists: string[];
  radio_allowed: boolean;
  podcasts_allowed: boolean;
  blocked_podcasts: string[];
  days: ParentalDay[];
  week_limit_seconds: number | null;
}
export interface ParentalPolicySnapshot {
  owner: string;
  revision: number;
  locked_by?: string | null;
  policy: ParentalPolicy;
}
export type ParentalReason =
  | "outside_schedule"
  | "daily_limit"
  | "weekly_limit"
  | "radio_blocked"
  | "podcast_blocked"
  | "artist_blocked"
  | "policy_unavailable";
export interface ParentalStatus extends ParentalPolicySnapshot {
  day_used_seconds: number;
  week_used_seconds: number;
  remaining_seconds: number | null;
  allowed: boolean;
  reason: ParentalReason | null;
  next_change_at: number | null;
}
const encoder = new TextEncoder();
const byteLength = (value: string) => encoder.encode(value).byteLength;
const object = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error(t("Contrôle parental Aède invalide."));
  return raw as Record<string, unknown>;
};
const natural = (raw: unknown): raw is number =>
  typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0;
const quota = (raw: unknown, maximum: number): raw is number | null =>
  raw === null || (natural(raw) && raw <= maximum);
function strings(raw: unknown, maximum: number, valid: (value: string) => boolean) {
  if (
    !Array.isArray(raw) ||
    raw.length > maximum ||
    raw.some((value) => typeof value !== "string" || !valid(value)) ||
    new Set(raw).size !== raw.length
  )
    throw Error(t("Contrôle parental Aède invalide."));
  return [...raw] as string[];
}
/** A valid saved timezone is kept literal; Aède owns clock, DST boundaries and quota accounting. */
export function parentalTimezone(raw: unknown): raw is string {
  if (typeof raw !== "string" || !raw || raw.length > 128) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: raw });
    return true;
  } catch {
    return false;
  }
}
/** Defensive parsing rejects malformed policies instead of inventing unrestricted defaults. */
export function parseParentalPolicy(raw: unknown): ParentalPolicy {
  const row = object(raw);
  if (
    typeof row.enabled !== "boolean" ||
    typeof row.radio_allowed !== "boolean" ||
    (row.podcasts_allowed !== undefined && typeof row.podcasts_allowed !== "boolean") ||
    !parentalTimezone(row.timezone) ||
    !Array.isArray(row.days) ||
    row.days.length !== 7 ||
    !quota(row.week_limit_seconds, 604800)
  )
    throw Error(t("Contrôle parental Aède invalide."));
  const days = row.days.map((raw): ParentalDay => {
    const day = object(raw);
    if (!Array.isArray(day.windows) || day.windows.length > 8 || !quota(day.limit_seconds, 86400))
      throw Error(t("Horaires de contrôle parental invalides."));
    let previous = 0;
    const windows = day.windows.map((raw) => {
      const value = object(raw);
      if (
        !natural(value.start_minute) ||
        !natural(value.end_minute) ||
        value.start_minute >= value.end_minute ||
        value.end_minute > 1440 ||
        value.start_minute < previous
      )
        throw Error(t("Horaires de contrôle parental invalides."));
      previous = value.end_minute;
      return { start_minute: value.start_minute, end_minute: value.end_minute };
    });
    return { windows, limit_seconds: day.limit_seconds };
  });
  return {
    enabled: row.enabled,
    timezone: row.timezone,
    radio_allowed: row.radio_allowed,
    podcasts_allowed: row.podcasts_allowed === undefined ? true : (row.podcasts_allowed as boolean),
    days,
    week_limit_seconds: row.week_limit_seconds,
    blocked_artists: strings(
      row.blocked_artists,
      256,
      (value) =>
        value.startsWith("artist:") &&
        !value.startsWith("artist:@phemios/") &&
        value.length > 7 &&
        byteLength(value) <= 16384 &&
        ![...value].some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ),
    ),
    blocked_podcasts: strings(row.blocked_podcasts, 128, (value) => {
      if (byteLength(value) > 2048) return false;
      try {
        const url = new URL(value);
        return (
          ["https:", "http:"].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !!url.hostname
        );
      } catch {
        return false;
      }
    }),
  };
}
/** Stable target ownership and optimistic revision prevent cross-account and stale writes. */
export function parseParentalPolicySnapshot(
  raw: unknown,
  expectedOwner?: string,
): ParentalPolicySnapshot {
  const row = object(raw);
  if (
    typeof row.owner !== "string" ||
    !row.owner ||
    row.owner.length > 256 ||
    (expectedOwner !== undefined && row.owner !== expectedOwner) ||
    !natural(row.revision) ||
    (row.locked_by !== undefined &&
      row.locked_by !== null &&
      (typeof row.locked_by !== "string" || !row.locked_by || row.locked_by.length > 256))
  )
    throw Error(t("Contrôle parental Aède invalide."));
  return {
    owner: row.owner,
    revision: row.revision,
    policy: parseParentalPolicy(row.policy),
    ...(row.locked_by !== undefined ? { locked_by: row.locked_by as string | null } : {}),
  };
}
/** Status is authoritative; the client displays deadlines and never recomputes authorization locally. */
export function parseParentalStatus(raw: unknown): ParentalStatus {
  const row = object(raw),
    snapshot = parseParentalPolicySnapshot(row);
  const reasons: readonly unknown[] = [
    "outside_schedule",
    "daily_limit",
    "weekly_limit",
    "radio_blocked",
    "podcast_blocked",
    "artist_blocked",
    "policy_unavailable",
  ];
  if (
    !natural(row.day_used_seconds) ||
    !natural(row.week_used_seconds) ||
    (row.remaining_seconds !== null && !natural(row.remaining_seconds)) ||
    typeof row.allowed !== "boolean" ||
    (row.reason !== null && !reasons.includes(row.reason)) ||
    (row.allowed && row.reason !== null) ||
    (!row.allowed && row.reason === null) ||
    (row.next_change_at !== null && !natural(row.next_change_at))
  )
    throw Error(t("Contrôle parental Aède invalide."));
  return {
    ...snapshot,
    day_used_seconds: row.day_used_seconds,
    week_used_seconds: row.week_used_seconds,
    remaining_seconds: row.remaining_seconds,
    allowed: row.allowed,
    reason: row.reason as ParentalReason | null,
    next_change_at: row.next_change_at,
  };
}
/** Fresh editor defaults remain inactive until the administrator explicitly saves them. */
export function defaultParentalPolicy(timezone = "UTC"): ParentalPolicy {
  return {
    enabled: false,
    timezone,
    blocked_artists: [],
    radio_allowed: true,
    podcasts_allowed: true,
    blocked_podcasts: [],
    days: Array.from({ length: 7 }, () => ({
      windows: [{ start_minute: 0, end_minute: 1440 }],
      limit_seconds: null,
    })),
    week_limit_seconds: null,
  };
}

/** Canonical presentation identity ignores JSON key ordering without dropping any policy field. */
export function parentalPolicyStamp(policy: ParentalPolicy | undefined): string {
  return JSON.stringify(
    policy
      ? [
          policy.enabled,
          policy.timezone,
          policy.radio_allowed,
          policy.podcasts_allowed,
          policy.blocked_artists,
          policy.blocked_podcasts,
          policy.week_limit_seconds,
          policy.days.map((day) => [
            day.limit_seconds,
            day.windows.map((window) => [window.start_minute, window.end_minute]),
          ]),
        ]
      : null,
  );
}

/** A restriction stores an inert canonical feed identifier; it never fetches the URL. */
export function parentalPodcastFeed(value: string): string {
  try {
    const url = new URL(value.trim());
    if (
      byteLength(value) > 2048 ||
      !["https:", "http:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    )
      throw Error();
    url.hash = "";
    if (byteLength(url.href) > 2048) throw Error();
    return url.href;
  } catch {
    throw Error(t("Adresse podcast invalide."));
  }
}
