import { spawnSync } from "node:child_process";
import { mkdirSync, copyFileSync, chmodSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "..");
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.error || result.status !== 0)
    throw new Error(`${command} failed while preparing the embedded engine.`);
  return result.stdout.trim();
}
const triple = run("rustc", ["-vV"], root)
  .split("\n")
  .find((line) => line.startsWith("host: "))
  ?.slice(6);
if (!triple) throw new Error("Rust host target is unavailable.");
const extension = process.platform === "win32" ? ".exe" : "";
let binary = process.env.PHEMIOS_AEDE_BINARY;
if (!binary) {
  const source = resolve(process.env.PHEMIOS_AEDE_SOURCE ?? join(root, "..", "aede"));
  run("cargo", ["build", "--release", "--locked", "--offline", "-p", "aede-cli"], source);
  binary = join(source, "target", "release", `aede${extension}`);
}
const folder = join(root, "src-tauri", "binaries");
mkdirSync(folder, { recursive: true });
const output = join(folder, `phemios-aede-${triple}${extension}`);
copyFileSync(binary, output);
if (process.platform !== "win32") chmodSync(output, 0o755);
console.log(`[Phémios] Embedded Aède prepared for ${triple}.`);
