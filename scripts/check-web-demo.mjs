import { access, readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
/** Refuse accidental personal builds, broken subpath assets and missing/unattributed recordings before publication. */
export async function checkWebDemo(root) {
  const read = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
  const build = await read("web-build.json"),
    provenance = await read("web-audio/wasm/provenance.json");
  if (
    build.profile !== "public-demo" ||
    build.base !== "./" ||
    !/^[0-9a-f]{40}$/.test(build.sharedAudio) ||
    provenance.sharedAudio !== build.sharedAudio
  )
    throw new Error(
      "The website requires a checked public-demo build with relative assets and coherent shared audio.",
    );
  for (const file of [
    "index.html",
    "web-audio/processor.js",
    "web-audio/wasm/phemios_web_audio.js",
    "web-demo/ATTRIBUTION.txt",
  ])
    await access(path.join(root, file));
  const wasm = await readFile(path.join(root, "web-audio/wasm/phemios_web_audio_bg.wasm"));
  if (!wasm.subarray(0, 4).equals(Buffer.from([0, 97, 115, 109])))
    throw new Error("WebAssembly binary is missing or invalid.");
  const html = await readFile(path.join(root, "index.html"), "utf8");
  for (const [, url] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (!url.startsWith("./") || url.includes(".."))
      throw new Error("Public demo assets must remain relative to their hosting subdirectory.");
    await access(path.join(root, url));
  }
  const credits = await read("web-demo/credits.json");
  if (!Array.isArray(credits) || credits.length < 10)
    throw new Error("Public demo recording credits are incomplete.");
  const files = new Set();
  for (const row of credits) {
    if (
      !/^audio\/[a-z0-9]+\.(mp3|m4a)$/.test(row.file) ||
      files.has(row.file) ||
      typeof row.artist !== "string" ||
      !row.artist ||
      row.licence !== "CC BY 4.0" ||
      row.licence_url !== "https://creativecommons.org/licenses/by/4.0/" ||
      row.modified !== false ||
      !/^[0-9a-f]{64}$/.test(row.sha256)
    )
      throw new Error("Invalid or duplicated public demo attribution.");
    files.add(row.file);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path.join(root, "web-demo", row.file)))
      hash.update(chunk);
    if (hash.digest("hex") !== row.sha256)
      throw new Error(`Demo recording differs from its credited source: ${row.file}`);
    await access(
      path.join(root, "web-demo", row.file.replace(/^audio\//, "").replace(/\.(mp3|m4a)$/, ".svg")),
    );
  }
}
