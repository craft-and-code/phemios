import { t } from "../i18n";
/** Extended titles are display-only; file paths never become native playback requests. */
export function m3uTitles(content: string): string[] {
  if (!content.startsWith("#EXTM3U") || content.length > 8 * 1024 * 1024)
    throw Error(t("Contenu M3U invalide."));
  return content
    .split(/\r?\n/)
    .filter((line) => line.startsWith("#EXTINF:"))
    .map((line) => line.slice(line.indexOf(",") + 1));
}
