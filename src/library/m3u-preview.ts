import { t } from "../i18n";
/** Playlist entries are display-only; paths and URLs never become playback or native file requests. */
export function m3uTitles(content: string, allowSimple = false): string[] {
  const text = content.replace(/^\uFEFF/, "");
  if (
    (!allowSimple && !text.startsWith("#EXTM3U")) ||
    content.length > 8 * 1024 * 1024 ||
    content.includes("\0")
  )
    throw Error(t("Contenu M3U invalide."));
  const titles: string[] = [];
  let title = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      const separator = line.indexOf(",");
      title = separator >= 0 ? line.slice(separator + 1).trim() : "";
    } else if (!line.startsWith("#")) {
      titles.push(title || line.split(/[\\/]/).pop() || line);
      title = "";
      if (titles.length > 4096) throw Error(t("Contenu M3U invalide."));
    }
  }
  return titles;
}
