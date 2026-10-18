import { spawnSync } from "node:child_process";
import {
  readFileSync,
  mkdirSync,
  mkdtempSync,
  copyFileSync,
  writeFileSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { publishedRelease, requireEngineVersions } from "./engine-policy.mjs";
const root = resolve(import.meta.dirname, "..");
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.error || result.status !== 0)
    throw new Error(`${command} failed during explicit engine update.`);
  return result.stdout.trim();
}
async function release(repo) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(
      `https://api.github.com/repos/craft-and-code/${repo}/releases/latest`,
      {
        signal: controller.signal,
        redirect: "error",
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Phemios-engine-maintenance",
        },
      },
    );
    if (!response.ok || !response.body)
      throw new Error(`GitHub release lookup failed (${response.status}).`);
    let length = 0;
    const chunks = [];
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > 1024 * 1024) {
        controller.abort();
        throw new Error("Release metadata is oversized.");
      }
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    clearTimeout(timer);
  }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check"))
    throw new Error("Usage: npm run engines:update [-- --check]");
  const requirements = JSON.parse(readFileSync(join(root, "engines.required.json"), "utf8"));
  const metadata = await Promise.all([release("aede"), release("FlacCompagnon")]);
  for (let i = 0; i < metadata.length; i++)
    console.log(
      `${i === 0 ? "Aède" : "FlacCompagnon"}: ${metadata[i].tag_name} (${metadata[i].published_at})`,
    );
  const aede = publishedRelease(metadata[0]),
    flac = publishedRelease(metadata[1]);
  requireEngineVersions({ aede: aede.version, flaccompagnon: flac.version }, requirements);
  if (args[0] === "--check") return;
  const cache = join(root, ".engine-cache");
  mkdirSync(cache, { recursive: true, mode: 0o700 });
  const temporary = mkdtempSync(join(cache, "source-"));
  try {
    run("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      aede.tag,
      "--",
      "https://github.com/craft-and-code/aede.git",
      temporary,
    ]);
    const manifest = readFileSync(join(temporary, "Cargo.toml"), "utf8");
    const tag = manifest.match(/^flaccompagnon-core\s*=\s*\{[^\n]*\btag\s*=\s*"([^"]+)"/m)?.[1];
    if (tag?.replace(/^v/, "") !== flac.version)
      throw new Error(
        "The published Aède release does not yet pin the latest published FlacCompagnon. Publish a refreshed Aède first; no unreviewed source patch is applied.",
      );
    run("cargo", ["fetch", "--locked"], temporary);
    run("cargo", ["build", "--release", "--locked", "--offline", "-p", "aede-cli"], temporary);
    const extension = process.platform === "win32" ? ".exe" : "";
    const binary = join(temporary, "target", "release", `aede${extension}`);
    const actual = JSON.parse(run(binary, ["--version", "--json"]));
    if (actual.aede !== aede.version || actual.flaccompagnon !== flac.version)
      throw new Error("Built release versions do not match the selected published sources.");
    const destination = join(cache, "release");
    mkdirSync(destination, { recursive: true });
    const output = join(destination, `aede${extension}`);
    copyFileSync(binary, output);
    if (process.platform !== "win32") chmodSync(output, 0o755);
    const hash = createHash("sha256").update(readFileSync(output)).digest("hex");
    writeFileSync(
      join(destination, "versions.json"),
      JSON.stringify({
        ...actual,
        sha256: hash,
        commit: run("git", ["rev-parse", "HEAD"], temporary),
      }),
    );
    console.log("Published engines prepared. Development startup remains locked and offline.");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
