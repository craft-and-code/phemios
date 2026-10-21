import { resolveStableRelease } from "./audio-source.mjs";
import { prepareEngine } from "./prepare-engine.mjs";
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--check")
    console.log(JSON.stringify(await resolveStableRelease()));
  else if (args.length === 0) await prepareEngine();
  else throw new Error("Usage: node scripts/update-engines.mjs [--check]");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
