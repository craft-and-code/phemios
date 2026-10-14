import { t } from "../i18n";
export interface MoodRule {
  id: string;
  name: string;
  tags: string[];
  genres: string[];
  acoustic?: "slow" | "fast" | "dark" | "bright";
}
export interface MoodPage {
  moods: { rule: MoodRule; count: number; model?: { examples: number; radius: number } | null }[];
  items: {
    reference: string;
    title: string;
    release: string | null;
    number: number;
    album_total: number;
    reason: {
      tag: string | null;
      genre: string | null;
      scope?: "track" | "album" | "artist" | "genre" | "acoustic";
      audio?:
        | { kind: "neighbor"; distance: number; examples: number }
        | { kind: "descriptor"; value: number; unit: "bpm" | "hz" };
    };
  }[];
  total: number;
  offset: number;
  scanned_at: number;
  selection_revision?: string;
  acoustic?: {
    profile: number;
    ready: number;
    missing: number;
    cache_errors: number;
    warming: boolean;
  };
}
/** Atmospheres remain explainable personal rules, not inferred emotions. */
export function parseMoods(raw: unknown): MoodPage {
  const row = raw as MoodPage;
  if (
    !row ||
    !Array.isArray(row.moods) ||
    row.moods.length > 41 ||
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
      (!mood.rule.acoustic && mood.rule.tags.length + mood.rule.genres.length === 0) ||
      (mood.rule.acoustic !== undefined &&
        (!["slow", "fast", "dark", "bright"].includes(mood.rule.acoustic) ||
          mood.rule.id !== `@aede/audio/${mood.rule.acoustic}`)) ||
      (mood.model != null &&
        (!Number.isSafeInteger(mood.model.examples) ||
          mood.model.examples < 2 ||
          mood.model.examples > 16 ||
          !Number.isFinite(mood.model.radius) ||
          mood.model.radius < 0.045 ||
          mood.model.radius > 0.181)) ||
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
        !["track", "album", "artist", "genre", "acoustic"].includes(item.reason.scope)) ||
      !validAudioReason(item.reason) ||
      [item.reason.tag, item.reason.genre].some(
        (value) => value !== null && typeof value !== "string",
      )
    )
      throw new Error(t("Ambiances Aède invalides."));
  if (
    row.selection_revision !== undefined &&
    (typeof row.selection_revision !== "string" || !/^[0-9a-f]{16}$/.test(row.selection_revision))
  )
    throw new Error(t("Ambiances Aède invalides."));
  if (
    row.acoustic &&
    (!Number.isSafeInteger(row.acoustic.profile) ||
      row.acoustic.profile < 1 ||
      typeof row.acoustic.warming !== "boolean" ||
      ![row.acoustic.ready, row.acoustic.missing, row.acoustic.cache_errors].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ))
  )
    throw new Error(t("Ambiances Aède invalides."));
  return row;
}
function validAudioReason(reason: MoodPage["items"][number]["reason"]): boolean {
  const audio = reason.audio;
  if (reason.scope !== "acoustic") return audio === undefined;
  if (!audio || reason.tag !== null || reason.genre !== null) return false;
  if (audio.kind === "neighbor")
    return (
      Number.isFinite(audio.distance) &&
      audio.distance >= 0 &&
      audio.distance <= 1 &&
      Number.isSafeInteger(audio.examples) &&
      audio.examples >= 2 &&
      audio.examples <= 16
    );
  return (
    audio.kind === "descriptor" &&
    Number.isFinite(audio.value) &&
    (audio.unit === "hz"
      ? audio.value >= 0 && audio.value <= 11025
      : audio.unit === "bpm" && audio.value >= 50 && audio.value <= 220)
  );
}
/** Localize untouched presets while preserving explicit owner-defined names. */
export function moodName(rule: MoodRule): string {
  const presets: Record<string, [string, string]> = {
    "@aede/audio/slow": ["Slow tempo", t("Tempo lent")],
    "@aede/audio/fast": ["Fast tempo", t("Tempo rapide")],
    "@aede/audio/dark": ["Low spectral centre", t("Centre spectral bas")],
    "@aede/audio/bright": ["High spectral centre", t("Centre spectral élevé")],
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
  if (reason.audio?.kind === "neighbor")
    return t("Proximité audio · {0} exemples", reason.audio.examples);
  if (reason.audio?.kind === "descriptor")
    return reason.audio.unit === "bpm"
      ? t("Tempo estimé : {0} BPM", Math.round(reason.audio.value))
      : t("Centre spectral : {0} Hz", Math.round(reason.audio.value));
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
