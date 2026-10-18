import type { Language } from "../i18n";
/** An attributed Wikipedia URL identifies an exact title, never a search by artist name. */
export function biographyTarget(
  value: string | undefined,
): { language: Language; title: string } | undefined {
  if (!value || value.length > 4096) return;
  try {
    const url = new URL(value);
    const match = /^(fr|en)\.wikipedia\.org$/.exec(url.hostname);
    if (
      url.protocol !== "https:" ||
      !match ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !url.pathname.startsWith("/wiki/")
    )
      return;
    const title = decodeURIComponent(url.pathname.slice(6)).replaceAll("_", " ");
    if (!title.trim() || title.length > 2048 || /[|#\p{Cc}]/u.test(title)) return;
    return { language: match[1] as Language, title };
  } catch {
    return;
  }
}
/** Presentation only: preserve existing NBSP and keep French punctuation with its preceding word. */
export function readingTypography(text: string, language: Language): string {
  if (language !== "fr") return text;
  return text
    .replace(/([^\s]) +([;!?»])/gu, "$1\u202f$2")
    .replace(/([^\s]) +:/gu, "$1\u00a0:")
    .replace(/« +(?=\S)/gu, "«\u202f");
}
