import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { prepareAudioSource } from "./audio-source.mjs";
const root = resolve(import.meta.dirname, "..");
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error(`Web preparation failed: ${command}`);
}
/** Select published shared audio and build only the browser adapter, never the native engine/application. */
export async function buildWebAudio() {
  const tool = process.env.PHEMIOS_WASM_BINDGEN ?? "wasm-bindgen";
  const version = spawnSync(tool, ["--version"], { encoding: "utf8" });
  if (version.status !== 0 || !/^wasm-bindgen 0\.2\.129(?:\s|$)/.test(version.stdout))
    throw new Error("Install wasm-bindgen-cli 0.2.129 before building Phémios Web.");
  const release = process.env.AEDE_AUDIO_RELEASE
    ? JSON.parse(process.env.AEDE_AUDIO_RELEASE)
    : undefined;
  await prepareAudioSource({ root, release, engine: false });
  const args =
    process.env.PHEMIOS_WASM_BUILD_STD === "1"
      ? ["-Z", "build-std=std,panic_abort", "build"]
      : ["build"];
  run("cargo", [
    ...args,
    "-p",
    "phemios-web-audio",
    "--target",
    "wasm32-unknown-unknown",
    "--release",
    "--locked",
    "--offline",
  ]);
  const out = join(root, "web-public/web-audio/wasm");
  mkdirSync(out, { recursive: true });
  run(tool, [
    "--target",
    "web",
    "--out-dir",
    out,
    join(root, "target/wasm32-unknown-unknown/release/phemios_web_audio.wasm"),
  ]);
  const lock = readFileSync(join(root, "Cargo.lock"), "utf8");
  const revision = lock.match(
    /name = "aede-audio"[\s\S]*?source = "git\+[^"\n]+#([0-9a-f]{40})"/,
  )?.[1];
  if (!revision) throw new Error("Shared audio revision is missing from Cargo.lock.");
  writeFileSync(
    join(out, "provenance.json"),
    JSON.stringify({
      sharedAudio: revision,
      adapter: "phemios-web-audio",
      wasmBindgen: "0.2.129",
    }) + "\n",
  );
}
export function prepareWebPublic() {
  // Web music/WASM have their own public directory; native builds never package them.
  cpSync(join(root, "public"), join(root, "web-public"), { recursive: true });
}
if (process.argv[1] === import.meta.filename) {
  await buildWebAudio();
  prepareWebPublic();
}
