import { createHash } from "node:crypto";
import {
  readFileSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

export const packages = {
  "macOS-AppleSilicon": [".dmg"],
  "Linux-x86_64": [".AppImage", ".deb", ".rpm"],
  "Windows-x64": [".msi", ".exe"],
};
/** Refuse misleading tags or divergent application manifests before any release build. */
export function releaseVersion(root, tag) {
  const json = (name) => JSON.parse(readFileSync(join(root, name), "utf8"));
  const version = json("package.json").version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("A stable release version is required.");
  const cargo = readFileSync(join(root, "Cargo.toml"), "utf8").match(
    /^version\s*=\s*"([^"]+)"/m,
  )?.[1];
  const lock = json("package-lock.json");
  if (
    [
      cargo,
      json("src-tauri/tauri.conf.json").version,
      lock.version,
      lock.packages?.[""]?.version,
    ].some((v) => v !== version)
  )
    throw new Error("Cargo, npm, npm lock and Tauri versions must agree.");
  if (tag !== undefined && tag !== `v${version}`)
    throw new Error("The tag does not match the application version.");
  return version;
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : [];
  });
}
/** Require exactly one of every expected installer; package only this platform's files. */
export function packageRelease(root, label, tag) {
  const extensions = packages[label];
  if (!extensions) throw new Error("Unknown release platform.");
  const version = releaseVersion(root, tag);
  const source = files(join(root, "target/release/bundle"));
  const selected = extensions.map((extension) => {
    const matches = source.filter((path) => path.endsWith(extension));
    if (matches.length !== 1) throw new Error(`Expected exactly one ${extension} installer.`);
    return { path: matches[0], name: `phemios-App-${version}-${label}${extension}` };
  });
  const output = join(root, "dist-release");
  // A reused output directory must not silently publish packages from an earlier run.
  if (existsSync(output) && readdirSync(output).length)
    throw new Error("Release output must be empty.");
  mkdirSync(output, { recursive: true });
  for (const { path, name } of selected) {
    copyFileSync(path, join(output, name));
    const sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
    writeFileSync(join(output, `${name}.sha256`), `${sha256}  ${name}\n`);
  }
  return selected.map(({ name }) => name);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(import.meta.dirname, "..");
  const [command, label] = process.argv.slice(2);
  const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined;
  if (command === "verify" && !label) console.log(releaseVersion(root, tag));
  else if (command === "package" && label) console.log(packageRelease(root, label, tag).join("\n"));
  else throw new Error("Usage: node scripts/release.mjs verify | package PLATFORM");
}
