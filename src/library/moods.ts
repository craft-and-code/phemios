import { t } from "../i18n";
export interface MoodRule {
  id: string;
  name: string;
  tags: string[];
  genres: string[];
}
export interface MoodPage {
  moods: { rule: MoodRule; count: number }[];
  items: {
    reference: string;
    title: string;
    release: string | null;
    number: number;
    album_total: number;
    reason: {
      tag: string | null;
      genre: string | null;
      scope?: "track" | "album" | "artist" | "genre";
    };
  }[];
  total: number;
  offset: number;
  scanned_at: number;
}
/** Atmospheres remain explainable personal rules, not inferred emotions. */
export function parseMoods(raw: unknown): MoodPage {
  const row = raw as MoodPage;
  if (
    !row ||
    !Array.isArray(row.moods) ||
    row.moods.length > 37 ||
    !Array.isArray(row.items) ||
    row.items.length > 200 ||
    ![row.total, row.offset, row.scanned_at].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) ||
    (row.items.length && row.offset + row.items.length > row.total)
  )
    throw new Error(t("Ambiances Aède invalides."));
  for (const mood of row.moods)
    if (
      !mood.rule ||
      ![mood.rule.id, mood.rule.name].every((value) => typeof value === "string") ||
      !Array.isArray(mood.rule.tags) ||
      !Array.isArray(mood.rule.genres) ||
      mood.rule.tags.length > 32 ||
      mood.rule.genres.length > 32 ||
      mood.rule.tags.length + mood.rule.genres.length === 0 ||
      [...mood.rule.tags, ...mood.rule.genres].some((value) => typeof value !== "string") ||
      !Number.isSafeInteger(mood.count) ||
      mood.count < 0
    )
      throw new Error(t("Ambiances Aède invalides."));
  for (const item of row.items)
    if (
      typeof item.reference !== "string" ||
      !item.reference.startsWith("track:") ||
      typeof item.title !== "string" ||
      (item.release !== null &&
        (typeof item.release !== "string" || !item.release.startsWith("release:"))) ||
      !Number.isSafeInteger(item.number) ||
      item.number < 1 ||
      !Number.isSafeInteger(item.album_total) ||
      item.album_total < item.number ||
      !item.reason ||
      (item.reason.scope !== undefined &&
        !["track", "album", "artist", "genre"].includes(item.reason.scope)) ||
      [item.reason.tag, item.reason.genre].some(
        (value) => value !== null && typeof value !== "string",
      )
    )
      throw new Error(t("Ambiances Aède invalides."));
  return row;
}
/** Localize untouched presets while preserving explicit owner-defined names. */
export function moodName(rule: MoodRule): string {
  const presets: Record<string, [string, string]> = {
    calm: ["Relaxation", t("Relaxation")],
    energy: ["Energy", t("Énergie")],
    focus: ["Focus", t("Concentration")],
    party: ["Party", t("Fête")],
    melancholy: ["Melancholy", t("Mélancolie")],
  };
  const preset = presets[rule.id];
  return preset && rule.name === preset[0] ? preset[1] : rule.name;
}

/** Explain the most specific retained evidence; old servers remain readable without a source label. */
export function moodReason(reason: MoodPage["items"][number]["reason"]): string {
  if (!reason.tag) return t("Genre : {0}", reason.genre ?? "");
  switch (reason.scope) {
    case "track":
      return t("Tag de la piste : {0}", reason.tag);
    case "album":
      return t("Tag de l’album : {0}", reason.tag);
    case "artist":
      return t("Tag de l’artiste : {0}", reason.tag);
    default:
      return t("Tag : {0}", reason.tag);
  }
}
