import { spawn } from "node:child_process";
import { buildWebAudio, prepareWebPublic } from "./build-web-audio.mjs";
await buildWebAudio();
prepareWebPublic();
const child = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", ...process.argv.slice(2), "--config", "vite.web.config.ts"],
  { stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
