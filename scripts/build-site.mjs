import { cp, rm, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { generateSite } from "./site-content.mjs";
import { checkSite } from "./check-site.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  output = path.join(root, "dist-site");
const args = process.argv.slice(2);
if (args.length > 1 || (args.length && args[0] !== "--reuse-technical"))
  throw Error("Use build-site.mjs [--reuse-technical]");
if (!args.length) {
  for (const [program, argv] of [
    [process.execPath, ["scripts/typescript-docs.mjs"]],
    [process.execPath, ["scripts/component-explorer.mjs", "build"]],
    ["cargo", ["doc", "--workspace", "--no-deps", "--locked", "--offline"]],
  ]) {
    const result = spawnSync(program, argv, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, RUSTDOCFLAGS: "-D warnings" },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error(`Technical documentation failed: ${program}`);
  }
}
const copies = [
  ["dist-docs/components", "components"],
  ["target/doc", "rust"],
  ["dist-docs/frontend", "typescript"],
];
for (const [source] of copies) await access(path.join(root, source));
await rm(output, { recursive: true, force: true });
await generateSite(root, output);
for (const [source, destination] of copies)
  await cp(path.join(root, source), path.join(output, destination), { recursive: true });
await checkSite(output);
console.log(`Phémios website, bilingual manual, Rustdoc and Storybook: ${output}`);
