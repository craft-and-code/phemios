import { t } from "../i18n";
import { parsePodcastAccountState, type PodcastAccountState } from "../podcasts/account-store";
import { parseAccountArticles } from "../encyclopedia/account-saved";
import type { WikipediaArticle } from "../encyclopedia/wikipedia";
import {
  exportPreferenceBackup,
  parsePreferenceBackup,
  type PreferenceBackup,
} from "./preference-backup";
export interface PersonalBackup {
  origin: { source: "local" | "server"; authority: string; accountId: string; name: string };
  podcasts: PodcastAccountState;
  articles: WikipediaArticle[];
}
export interface ApplicationBackup {
  values: PreferenceBackup;
  personal?: PersonalBackup;
}
const limit = 12 * 1024 * 1024;
function invalid(): never {
  throw new Error(t("Sauvegarde des préférences invalide."));
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, allowed: string[]) {
  if (
    Object.keys(value).length !== allowed.length ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    invalid();
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\p{Cc}]/u.test(value))
    invalid();
  return value;
}
/** Attribution describes the source of the backup only; it never selects an import owner. */
export function parsePersonalBackup(raw: unknown): PersonalBackup {
  const value = object(raw),
    origin = object(value.origin),
    podcasts = object(value.podcasts);
  fields(value, ["origin", "podcasts", "articles"]);
  fields(origin, ["source", "authority", "accountId", "name"]);
  fields(podcasts, ["feeds", "episodes"]);
  if (origin.source !== "local" && origin.source !== "server") invalid();
  const authority = text(origin.authority, 4096);
  if (origin.source === "local" && authority !== "phemios-managed-local") invalid();
  return {
    origin: {
      source: origin.source,
      authority,
      accountId: text(origin.accountId, 256),
      name: text(origin.name, 256),
    },
    podcasts: parsePodcastAccountState(podcasts),
    articles: parseAccountArticles({ version: 1, articles: value.articles }),
  };
}
/** Preferences stay compatible with v1; authenticated private records are explicit in v2. No legacy/device-private store is read. */
export function exportApplicationBackup(
  storage: Pick<Storage, "getItem">,
  personal?: unknown,
): string {
  const preferences = exportPreferenceBackup(storage);
  if (personal === undefined) return preferences;
  const raw = JSON.stringify({
    ...JSON.parse(preferences),
    version: 2,
    personal: parsePersonalBackup(personal),
  });
  parseApplicationBackup(raw);
  return raw;
}
/** Validate all portable data before review, bounded by the same UTF-8 file budget as native transport. */
export function parseApplicationBackup(raw: string): ApplicationBackup {
  if (raw.length > limit || new TextEncoder().encode(raw).byteLength > limit) invalid();
  const document = object(JSON.parse(raw));
  if (document.version === 1) return { values: parsePreferenceBackup(raw) };
  fields(document, ["format", "version", "values", "personal"]);
  if (document.format !== "phemios-preferences" || document.version !== 2) invalid();
  const values = parsePreferenceBackup(
    JSON.stringify({ format: document.format, version: 1, values: document.values }),
  );
  return { values, personal: parsePersonalBackup(document.personal) };
}
