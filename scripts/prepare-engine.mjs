import { mkdirSync, copyFileSync, chmodSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { prepareAudioSource, runCommand, selectedRelease } from "./audio-source.mjs";
import { requireEngineVersions } from "./engine-policy.mjs";

/** The embedded executable and client PCM primitives come from one selected stable source. */
export async function prepareEngine({
  root = resolve(import.meta.dirname, ".."),
  env = process.env,
  run = runCommand,
  prepare = prepareAudioSource,
} = {}) {
  if (env.PHEMIOS_AEDE_BINARY || env.PHEMIOS_AEDE_SOURCE)
    throw new Error(
      "Remove PHEMIOS_AEDE_BINARY/PHEMIOS_AEDE_SOURCE: automatic builds require the selected stable Aède source.",
    );
  const release = env.AEDE_AUDIO_RELEASE
    ? selectedRelease(JSON.parse(env.AEDE_AUDIO_RELEASE))
    : undefined;
  const selected = await prepare({ root, release, engine: true, run });
  const triple = run("rustc", ["-vV"], root)
    .split("\n")
    .find((line) => line.startsWith("host: "))
    ?.slice(6);
  if (!triple) throw new Error("Rust host target is unavailable.");
  const extension = process.platform === "win32" ? ".exe" : "";
  // A host sidecar must not reuse an old binary when Cargo configuration redirects artifacts.
  const target = join(selected.source, "target");
  run(
    "cargo",
    [
      "build",
      "--release",
      "--locked",
      "--offline",
      "--target",
      triple,
      "--target-dir",
      target,
      "-p",
      "aede-cli",
    ],
    selected.source,
  );
  const binary = join(target, triple, "release", `aede${extension}`);
  const versions = JSON.parse(run(binary, ["--version", "--json"], root));
  if (versions.aede !== selected.version)
    throw new Error("The embedded engine does not match the selected stable Aède version.");
  requireEngineVersions(
    versions,
    JSON.parse(readFileSync(join(root, "engines.required.json"), "utf8")),
  );
  const folder = join(root, "src-tauri", "binaries");
  mkdirSync(folder, { recursive: true });
  const output = join(folder, `phemios-aede-${triple}${extension}`);
  copyFileSync(binary, output);
  writeFileSync(
    join(folder, "versions.json"),
    JSON.stringify({
      aede: versions.aede,
      flaccompagnon: versions.flaccompagnon,
      audio_revision: selected.revision,
    }),
  );
  if (process.platform !== "win32") chmodSync(output, 0o755);
  console.log(`[Phémios] Stable Aède ${selected.tag} prepared for ${triple}.`);
  return selected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 2) throw new Error("Usage: node scripts/prepare-engine.mjs");
    await prepareEngine();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
