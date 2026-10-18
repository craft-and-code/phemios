import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
/** Exact locked versions, generated without executing Cargo/npm or accessing the network. */
export function dependencyCredits(root = fileURLToPath(new URL("../", import.meta.url))) {
  const npm = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
  const cargo = readFileSync(join(root, "Cargo.lock"), "utf8");
  return lockedCredits(npm, cargo);
}
/** Runtime npm packages and third-party Cargo lock entries; optional platform crates remain explicit. */
export function lockedCredits(npm, cargo) {
  const found = new Map();
  for (const [location, item] of Object.entries(npm.packages ?? {})) {
    if (!location || item.dev || !item.version) continue;
    const name = item.name ?? location.split("node_modules/").at(-1);
    if (!name || !/^(@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(name)) continue;
    found.set(`npm:${name}:${item.version}`, {
      name,
      version: item.version,
      ecosystem: "npm",
      url: `https://www.npmjs.com/package/${name}/v/${item.version}`,
    });
  }
  for (const block of cargo.split(/^\[\[package\]\]$/m).slice(1)) {
    const field = (name) => block.match(new RegExp(`^${name} = "([^"\\n]+)"`, "m"))?.[1];
    const name = field("name"),
      version = field("version");
    if (!field("source") || !name || !version) continue;
    found.set(`cargo:${name}:${version}`, {
      name,
      version,
      ecosystem: "cargo",
      url: `https://crates.io/crates/${name}/${version}`,
    });
  }
  return [...found.values()].sort(
    (a, b) =>
      a.ecosystem.localeCompare(b.ecosystem) ||
      a.name.localeCompare(b.name) ||
      a.version.localeCompare(b.version),
  );
}
