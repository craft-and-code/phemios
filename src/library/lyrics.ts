import { t } from "../i18n";
export interface Lyrics {
  source: string;
  synced: boolean;
  lines: { at_ms: number | null; text: string }[];
}
/** Preserve supplied timestamps and untimed lines without inventing synchronization. */
export function parseLyrics(raw: unknown, reference: string): Lyrics | null {
  const answer = raw as { track: string; lyrics: Lyrics | null };
  if (!answer || answer.track !== reference) throw new Error(t("Paroles Aède invalides."));
  if (answer.lyrics === null) return null;
  const value = answer.lyrics;
  if (
    !value ||
    typeof value.source !== "string" ||
    typeof value.synced !== "boolean" ||
    !Array.isArray(value.lines) ||
    value.lines.length > 10000 ||
    value.lines.some(
      (line) =>
        typeof line.text !== "string" ||
        (line.at_ms !== null && (!Number.isSafeInteger(line.at_ms) || line.at_ms < 0)),
    )
  )
    throw new Error(t("Paroles Aède invalides."));
  return value;
}
export function activeLyricTime(
  lyrics: Lyrics | null | undefined,
  position: number,
): number | null {
  if (!lyrics?.synced) return null;
  let latest: number | null = null;
  for (const line of lyrics.lines)
    if (line.at_ms !== null && line.at_ms <= position && (latest === null || line.at_ms > latest))
      latest = line.at_ms;
  return latest;
}

/** Only supplied timed groups may drive the Playback phrase; plain text has no invented clock. */
export function currentLyricText(lyrics: Lyrics | null | undefined, position: number): string {
  const time = activeLyricTime(lyrics, position);
  return time === null
    ? ""
    : (lyrics?.lines
        .filter((line) => line.at_ms === time)
        .map((line) => line.text)
        .join("\n") ?? "");
}
