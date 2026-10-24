// Freeze every baseline file except the exact, separately fingerprinted validation overlay.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  readFileSync,
  lstatSync,
  realpathSync,
  existsSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { resolve, join, relative, isAbsolute } from "node:path";
import { productBaseline } from "./ph-c09-policy.mjs";

export const kitPaths = Object.freeze([
  "scripts/ph-c09.mjs",
  "scripts/ph-c09-policy.mjs",
  "scripts/ph-c09-candidate.mjs",
  "scripts/ph-c09-evidence.mjs",
  "tests/ph-c09.test.mjs",
  "tests/ph-c09-runner.test.mjs",
  "tests/ph-c09-fixtures.mjs",
  "docs/quality/ph-c09-validation.md",
  "docs/quality/README.md",
  "docs/quality/audit-scope.md",
  "docs/quality/findings.md",
  "docs/quality/release-checklist.md",
]);
const overlays = new Set(kitPaths);
const digest = (data, algorithm = "sha256") => createHash(algorithm).update(data).digest("hex");
const split = (value) => value.toString("utf8").split("\0").filter(Boolean);
function gitAt(root) {
  return (args) => {
    const result = spawnSync("git", args, {
      cwd: root,
      encoding: "buffer",
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_NO_REPLACE_OBJECTS: "1" },
    });
    if (result.error || result.signal || result.status !== 0)
      throw Error(`Read-only Git inventory failed: git ${args.join(" ")}`);
    return result.stdout;
  };
}
function tree(value) {
  return new Map(
    split(value).map((row) => {
      const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(row);
      if (!match) throw Error("Unsupported baseline Git entry.");
      return [match[3], { mode: match[1], blob: match[2] }];
    }),
  );
}
function safePath(root, name) {
  if (
    !name ||
    name.includes("\\") ||
    isAbsolute(name) ||
    name.split("/").some((part) => ["", ".", ".."].includes(part))
  )
    throw Error("Invalid candidate path.");
  const path = join(root, name);
  if (realpathSync(path) !== path || !lstatSync(path).isFile())
    throw Error(`Candidate path is not a retained regular file: ${name}`);
  return path;
}

/** Compare raw bytes to the named Git object, not a potentially normalized diff. */
export function captureCandidate(root, { git = gitAt(root) } = {}) {
  root = realpathSync(root);
  const head = git(["rev-parse", "HEAD"]).toString("utf8").trim();
  if (!/^[a-f0-9]{40}$/.test(head)) throw Error("Invalid candidate HEAD.");
  if (git(["merge-base", productBaseline, "HEAD"]).toString("utf8").trim() !== productBaseline)
    throw Error("The frozen product baseline is not an ancestor of HEAD.");
  const baseline = tree(git(["ls-tree", "-rz", "--full-tree", productBaseline]));
  const committed = tree(git(["ls-tree", "-rz", "--full-tree", "HEAD"]));
  if (!baseline.size) throw Error("The frozen product baseline is unavailable.");
  const listed = new Set(
    split(git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])),
  );
  const dirty = [
    ...new Set([
      ...split(git(["diff", "--name-only", "-z", "HEAD"])),
      ...split(git(["diff", "--name-only", "-z", "--cached"])),
      ...[...listed].filter((name) => !committed.has(name)),
    ]),
  ].sort();
  for (const name of dirty)
    if (!overlays.has(name)) throw Error(`Dirty path outside the validation kit: ${name}`);
  for (const [name, entry] of committed) {
    if (overlays.has(name)) continue;
    const original = baseline.get(name);
    if (!original || original.blob !== entry.blob || original.mode !== entry.mode)
      throw Error(`HEAD differs from the frozen product baseline: ${name}`);
  }
  for (const name of listed)
    if (!baseline.has(name) && !overlays.has(name))
      throw Error(`Unexpected candidate path: ${name}`);
  for (const name of kitPaths)
    if (!existsSync(join(root, name))) throw Error(`Missing validation kit path: ${name}`);
  const productHashes = {},
    kitHashes = {};
  for (const name of [
    ...new Set([
      ...baseline.keys(),
      ...listed,
      ...kitPaths.filter((item) => existsSync(join(root, item))),
    ]),
  ].sort()) {
    const entry = baseline.get(name);
    if (!listed.has(name) && entry) throw Error(`Missing candidate path: ${name}`);
    if (!overlays.has(name) && !committed.has(name))
      throw Error(`HEAD removed a frozen product path: ${name}`);
    const path = safePath(root, name),
      bytes = readFileSync(path);
    if (overlays.has(name)) kitHashes[name] = digest(bytes);
    else {
      const blob = digest(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]), "sha1");
      const executable = Boolean(lstatSync(path).mode & 0o111);
      if (
        blob !== entry.blob ||
        (process.platform !== "win32" && executable !== (entry.mode === "100755"))
      )
        throw Error(`Frozen product bytes/mode changed: ${name}`);
      productHashes[name] = digest(bytes);
    }
  }
  return {
    baseline: productBaseline,
    head,
    productHashes,
    kitHashes,
    productDigest: digest(JSON.stringify(productHashes)),
    kitDigest: digest(JSON.stringify(kitHashes)),
    dirty,
  };
}

/** Also freeze validation scripts/docs throughout one run, including uncommitted overlays. */
export function assertCandidateUnchanged(before, after) {
  if (
    before.baseline !== after.baseline ||
    before.head !== after.head ||
    before.productDigest !== after.productDigest ||
    before.kitDigest !== after.kitDigest ||
    JSON.stringify(before.dirty) !== JSON.stringify(after.dirty)
  )
    throw Error(
      "Candidate or validation kit changed during the run; no reset/stash was attempted.",
    );
}

/** Resolve existing ancestors so an evidence symlink cannot point back into the checkout. */
export function validateEvidencePath(root, directory) {
  root = realpathSync(root);
  directory = resolve(directory);
  const parent = realpathSync(resolve(directory, ".."));
  const location = join(parent, relative(resolve(directory, ".."), directory));
  const inside = relative(root, location);
  if (
    !inside ||
    (!inside.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
      inside !== ".." &&
      !isAbsolute(inside))
  )
    throw Error("Evidence must be outside the repository.");
  if (existsSync(directory))
    throw Error("Evidence directory already exists; choose a fresh run path.");
  return location;
}

export function requireEmpty(root, path) {
  const directory = join(root, path);
  if (!existsSync(directory)) return;
  if (
    realpathSync(directory) !== directory ||
    !lstatSync(directory).isDirectory() ||
    readdirSync(directory).length
  )
    throw Error(`${path} must be an empty real directory; no files were cleaned.`);
}
function artifactFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) return artifactFiles(path);
    if (!entry.isFile() || realpathSync(path) !== path)
      throw Error("Artifact inventory encountered a nonregular path.");
    return [{ path, size: lstatSync(path).size, sha256: digest(readFileSync(path)) }];
  });
}
export function retainArtifacts(plan, root, evidence) {
  if (["prepare", "gate", "package"].includes(plan.stage)) {
    const path = join(root, ".audio-source/selection.json"),
      bytes = readFileSync(path),
      selected = JSON.parse(bytes);
    if (["tag", "version", "revision"].some((key) => selected[key] !== plan.release[key]))
      throw Error("Prepared source selection does not match the frozen Aède release.");
    evidence.manifest.sourceSelection = { selected, path, sha256: digest(bytes) };
  }
  if (plan.stage === "audit") {
    const source = join(root, "target/quality/vendor-audit/report.json");
    if (!existsSync(source)) throw Error("Supplemental vendor audit report is missing.");
    const output = join(evidence.directory, "vendor-audit-report.json");
    copyFileSync(source, output);
    evidence.manifest.supplementalAudit = { path: output, sha256: digest(readFileSync(output)) };
  }
  if (["gate", "package"].includes(plan.stage)) {
    const path = join(root, "src-tauri/binaries/versions.json"),
      versions = JSON.parse(readFileSync(path, "utf8"));
    if (versions.aede !== plan.release.version || versions.audio_revision !== plan.release.revision)
      throw Error("Prepared sidecar does not identify the frozen Aède release.");
    const binary = join(
      root,
      "src-tauri/binaries",
      `phemios-aede-${plan.rustTriple}${plan.platform === "windows" ? ".exe" : ""}`,
    );
    const mainBinary = join(
      plan.targetDirectory,
      plan.stage === "gate" ? "debug" : "release",
      `phemios${plan.platform === "windows" ? ".exe" : ""}`,
    );
    evidence.manifest.mainExecutable = {
      path: mainBinary,
      sha256: digest(readFileSync(mainBinary)),
      size: lstatSync(mainBinary).size,
    };
    evidence.manifest.engine = {
      versions,
      metadataSha256: digest(readFileSync(path)),
      path: binary,
      sha256: digest(readFileSync(binary)),
    };
  }
  if (plan.stage === "package") {
    evidence.manifest.artifacts = artifactFiles(join(root, "dist-release"));
    for (const artifact of evidence.manifest.artifacts.filter(
      (item) => !item.path.endsWith(".sha256"),
    )) {
      const name = artifact.path.split(/[\\/]/).at(-1);
      if (readFileSync(`${artifact.path}.sha256`, "utf8") !== `${artifact.sha256}  ${name}\n`)
        throw Error("Installer sidecar does not match artifact bytes/identity.");
    }
  }
}
