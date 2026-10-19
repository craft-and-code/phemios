import { t } from "../i18n";
export interface ResourceLink {
  label: string;
  url: string;
}
function publicAddress(value: string): boolean {
  if (value.length > 2048 || /[^\x21-\x7e]/u.test(value) || value.includes("\\")) return false;
  if (!/^https?:\/\/[^/?#%@]+(?:[/?#]|$)/iu.test(value)) return false;
  try {
    const url = new URL(value),
      host = url.hostname.toLowerCase().replace(/\.$/u, "");
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.port &&
      host.length <= 253 &&
      host.includes(".") &&
      !host.endsWith(".local") &&
      !host.endsWith(".localhost") &&
      !/^[\d.]+$/u.test(host) &&
      host
        .split(".")
        .every(
          (label) =>
            label.length > 0 &&
            label.length <= 63 &&
            !label.startsWith("-") &&
            !label.endsWith("-") &&
            /^[a-z0-9-]+$/u.test(label),
        )
    );
  } catch {
    return false;
  }
}
/** Optional labelled resources stay inert and bounded across IPC, saved copies and backups. */
export function parseResourceLinks(value: unknown): ResourceLink[] {
  if (
    !Array.isArray(value) ||
    value.length > 256 ||
    new TextEncoder().encode(JSON.stringify(value)).length > 128 * 1024
  )
    throw new Error(t("Réponse Wikipédia invalide."));
  const seen = new Set<string>();
  return value.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.label !== "string" ||
      !row.label.trim() ||
      row.label.length > 512 ||
      /\p{Cc}/u.test(row.label) ||
      typeof row.url !== "string" ||
      !publicAddress(row.url)
    )
      throw new Error(t("Réponse Wikipédia invalide."));
    const key = JSON.stringify([row.label, row.url]);
    if (seen.has(key)) throw new Error(t("Réponse Wikipédia invalide."));
    seen.add(key);
    return { label: row.label, url: row.url };
  });
}
export interface ResourcePart {
  text: string;
  url?: string;
}
function labelOffset(text: string, label: string, cursor: number): number {
  let at = text.indexOf(label, cursor);
  while (at >= 0) {
    const before = text.slice(Math.max(0, at - 2), at);
    const after = text.slice(at + label.length, at + label.length + 2);
    if (!/[\p{L}\p{N}\p{M}_]$/u.test(before) && !/^[\p{L}\p{N}\p{M}_]/u.test(after)) return at;
    at = text.indexOf(label, at + Math.max(1, label.length));
  }
  return -1;
}
/** Match source labels only inside the external-links section; never infer a URL from a name.
 * Each link occurrence is consumed once. Unmatched labels remain available as an explicit list.
 */
export function linkResourceBlocks(
  blocks: readonly { heading: boolean; text: string }[],
  links: readonly ResourceLink[] = [],
) {
  const remaining = [...links];
  let external = false;
  return {
    blocks: blocks.map((block) => {
      if (block.heading)
        external = ["liens externes", "external links"].includes(block.text.toLowerCase());
      const parts: ResourcePart[] = [];
      let cursor = 0;
      if (external && !block.heading)
        while (cursor < block.text.length) {
          let selected = -1,
            start = -1;
          remaining.forEach((link, index) => {
            const at = labelOffset(block.text, link.label, cursor);
            if (
              at >= 0 &&
              (start < 0 ||
                at < start ||
                (at === start && link.label.length > remaining[selected]!.label.length))
            ) {
              start = at;
              selected = index;
            }
          });
          if (selected < 0) break;
          const [link] = remaining.splice(selected, 1);
          if (start > cursor) parts.push({ text: block.text.slice(cursor, start) });
          parts.push({ text: link!.label, url: link!.url });
          cursor = start + link!.label.length;
        }
      if (cursor < block.text.length) parts.push({ text: block.text.slice(cursor) });
      return { ...block, parts };
    }),
    unmatched: remaining,
  };
}
