import { requestAede } from "../platform/desktop";
import { t } from "../i18n";
import { parseMoods } from "./moods";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
/** A capability probe and its private page form one captured-owner read. */
export async function readMoodReply(
  key: {
    session: AccountSession;
    source: SourceId;
    selected: string;
    offset: number;
    expected: string;
  },
  current: () => boolean,
) {
  if (!current()) return undefined;
  const info = await requestAede<{ capabilities?: string[] }>(
    "/api/v1/status",
    {},
    "GET",
    null,
    key.source,
    key.session,
  );
  if (!current()) return undefined;
  if (!info.capabilities?.includes("mood_rules"))
    throw new Error(t("Mettez à jour puis redémarrez Aède pour utiliser les ambiances."));
  const page = parseMoods(
    await requestAede(
      "/api/me/v1/moods",
      {
        ...(key.selected ? { mood: key.selected } : {}),
        offset: String(key.offset),
        limit: "50",
        ...(info.capabilities.includes("mood_audio_features")
          ? { audio: "true", ...(key.offset && key.expected ? { revision: key.expected } : {}) }
          : {}),
      },
      "GET",
      null,
      key.source,
      key.session,
    ),
  );
  if (!current()) return undefined;
  return {
    page,
    audio: info.capabilities.includes("mood_audio_features"),
    extractable: info.capabilities.includes("mood_audio_extraction"),
  };
}
