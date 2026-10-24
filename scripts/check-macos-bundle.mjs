import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 120_000 });
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} verification failed: ${result.stderr?.trim() || result.error?.message}`,
    );
  return { stdout: result.stdout, stderr: result.stderr };
}
function regular(path) {
  if (!lstatSync(path).isFile()) throw new Error(`Expected a regular bundle file: ${path}`);
  return path;
}
function signature(path, bundle = false) {
  run("codesign", ["--verify", ...(bundle ? ["--deep"] : []), "--strict", "--verbose=2", path]);
  const info = run("codesign", ["--display", "--verbose=4", path]).stderr;
  if (!/^Signature=adhoc$/m.test(info)) throw new Error(`Expected an ad-hoc signature: ${path}`);
  return info;
}
/** Verify the complete seal and required nested engine without changing the App. */
export function verifyMacosApp(app, expected) {
  if (process.platform !== "darwin")
    throw new Error("macOS signature verification requires macOS.");
  if (!lstatSync(app).isDirectory()) throw new Error("Expected an App directory, not a link.");
  const plist = regular(join(app, "Contents/Info.plist"));
  const info = JSON.parse(run("plutil", ["-convert", "json", "-o", "-", plist]).stdout);
  if (
    info.CFBundleIdentifier !== expected.identifier ||
    info.CFBundleShortVersionString !== expected.version
  )
    throw new Error("The signed App identity/version does not match this build.");
  if (info.CFBundleExecutable !== "phemios") throw new Error("Unexpected App executable.");
  const executable = regular(join(app, "Contents/MacOS/phemios"));
  const engine = regular(join(app, "Contents/MacOS/phemios-aede"));
  // Linker-only signatures have no bundle seal and must not pass as a signed App.
  const seal = regular(join(app, "Contents/_CodeSignature/CodeResources"));
  const details = signature(app, true);
  if (!details.split("\n").includes(`Identifier=${expected.identifier}`))
    throw new Error("The bundle signature has an unexpected identifier.");
  signature(executable);
  signature(engine);
  const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
  return {
    version: info.CFBundleShortVersionString,
    files: [plist, executable, engine, seal].map(digest),
  };
}
/** Mount read-only, verify the distributed App and detach even when a check fails. */
export function verifyMacosDmg(dmg, expected, reference) {
  regular(dmg);
  const mount = mkdtempSync(join(tmpdir(), "phemios-signature-"));
  let attached = false;
  try {
    run("hdiutil", ["attach", "-readonly", "-nobrowse", "-noautoopen", "-mountpoint", mount, dmg]);
    attached = true;
    const apps = readdirSync(mount).filter((name) => name.endsWith(".app"));
    if (apps.length !== 1) throw new Error("Expected exactly one App in the DMG.");
    const packaged = verifyMacosApp(join(mount, apps[0]), expected);
    if (JSON.stringify(packaged) !== JSON.stringify(reference))
      throw new Error("The DMG does not contain the verified build's App.");
    return packaged;
  } finally {
    if (attached) run("hdiutil", ["detach", mount]);
    rmSync(mount, { recursive: true, force: true });
  }
}
/** Standard host release builds use Cargo's default target/release/bundle directory. */
export function checkMacosBundles(root, { dmg = false } = {}) {
  if (process.platform !== "darwin") {
    console.log("[Phémios] macOS signature check is only applicable on macOS.");
    return;
  }
  const config = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"));
  const bundle = join(root, "target/release/bundle");
  const app = join(bundle, "macos", `${config.productName}.app`);
  const report = verifyMacosApp(app, config);
  if (dmg) {
    const folder = join(bundle, "dmg");
    const images = readdirSync(folder).filter((name) => name.endsWith(".dmg"));
    if (images.length !== 1) throw new Error("Expected exactly one DMG from this build.");
    verifyMacosDmg(join(folder, images[0]), config, report);
  }
  console.log(
    `[Phémios] Complete ad-hoc App/engine signatures verified${dmg ? "; read-only DMG copy matches" : ""}.`,
  );
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 2 && args[0] === "--app") {
      const config = JSON.parse(
        readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"),
      );
      console.log(verifyMacosApp(resolve(args[1]), config));
    } else if (args.length === 0 || (args.length === 1 && args[0] === "--dmg")) {
      checkMacosBundles(resolve(import.meta.dirname, ".."), { dmg: args[0] === "--dmg" });
    } else throw new Error("Usage: node scripts/check-macos-bundle.mjs [--dmg | --app PATH]");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
