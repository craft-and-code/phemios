import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
/** Check authored/generated editorial pages; bundled third-party technical HTML keeps its own contracts. */
export async function checkSite(root, { technical = true } = {}) {
  const pages = ["index.html", "en/index.html"];
  for (const lang of ["fr", "en"])
    for (const item of await readdir(path.join(root, "docs", lang)))
      if (item.endsWith(".html")) pages.push(`docs/${lang}/${item}`);
  const html = new Map();
  for (const page of pages) html.set(page, await readFile(path.join(root, page), "utf8"));
  for (const [page, text] of html) {
    if ((text.match(/<h1(?:\s|>)/g) ?? []).length !== 1)
      throw Error(`${page}: expected one main heading`);
    if (!text.includes('name="viewport"') || !text.includes('name="description"'))
      throw Error(`${page}: missing metadata`);
    const ids = [...text.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    if (new Set(ids).size !== ids.length) throw Error(`${page}: duplicate IDs`);
    for (const [, raw] of text.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (raw.startsWith("https://")) continue;
      if (/^[a-z]+:|^\/\//i.test(raw)) throw Error(`${page}: unsupported link ${raw}`);
      const [file, fragment] = raw.split("#"),
        relative = path.posix.normalize(
          path.posix.join(path.posix.dirname(page), decodeURIComponent(file.split("?")[0])),
        );
      const target = path.posix.normalize(
        file
          ? relative.endsWith("/") || !path.posix.extname(relative)
            ? `${relative.replace(/\/$/, "")}/index.html`
            : relative
          : page,
      );
      if (target.startsWith("../") || path.isAbsolute(target))
        throw Error(`${page}: link escapes site`);
      if (!technical && /^(components|rust|typescript)\//.test(target)) continue;
      await access(path.join(root, target)).catch(() => {
        throw Error(`${page}: missing target ${raw}`);
      });
      const destination = html.get(target);
      if (
        fragment &&
        destination &&
        ![...destination.matchAll(/\bid="([^"]+)"/g)].some(
          (m) => m[1] === decodeURIComponent(fragment),
        )
      )
        throw Error(`${page}: missing fragment ${raw}`);
    }
  }
  if (technical)
    for (const entry of [
      "components/index.html",
      "components/index.json",
      "rust/phemios_core/index.html",
      "typescript/index.html",
    ])
      await access(path.join(root, entry));
  console.log(
    `Validated ${pages.length} Phémios pages and local links${technical ? " with technical outputs" : ""}.`,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await checkSite(path.resolve(process.argv[2] ?? "dist-site"));
