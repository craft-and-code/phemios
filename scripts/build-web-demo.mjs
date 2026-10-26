import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { buildWebAudio, prepareWebPublic } from "./build-web-audio.mjs";
const root = resolve(import.meta.dirname, "..");
await buildWebAudio();
prepareWebPublic();
for (const args of [
  ["node_modules/typescript/bin/tsc", "--noEmit"],
  ["node_modules/vite/bin/vite.js", "build", "--config", "vite.web.config.ts", "--base", "./"],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, VITE_PHEMIOS_PUBLIC_DEMO: "true" },
  });
  if (result.error || result.status !== 0) throw new Error("Public Web demo build failed.");
}
const provenance = JSON.parse(
  readFileSync(join(root, "web-public/web-audio/wasm/provenance.json"), "utf8"),
);
writeFileSync(
  join(root, "dist-web/web-build.json"),
  JSON.stringify({ profile: "public-demo", base: "./", sharedAudio: provenance.sharedAudio }) +
    "\n",
);
