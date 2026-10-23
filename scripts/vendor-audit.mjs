// Local/path dependencies are not covered by cargo-audit's registry matching.
import { createHash } from "node:crypto";
import { readFile, readdir, lstat, mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve, join, isAbsolute, relative } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function confined(root, path) {
  if (
    typeof path !== "string" ||
    isAbsolute(path) ||
    path.includes("\\") ||
    path.split("/").includes("..")
  )
    throw Error("Invalid vendored source path.");
  const full = resolve(root, path);
  if (!relative(root, full) || relative(root, full).startsWith(".."))
    throw Error("Source escapes its root.");
  return full;
}
const digest = (data) => createHash("sha256").update(data).digest("hex");
async function inventoryFiles(root, path = "") {
  const result = {};
  for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
    const file = path ? `${path}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(result, await inventoryFiles(root, file));
    else if (entry.isFile()) result[file] = digest(await readFile(join(root, file)));
    else throw Error(`Unsupported vendored entry: ${file}`);
  }
  return result;
}
/** Verify every imported byte and ensure Cargo really resolves each reviewed local source. */
export async function verifyVendoredSources(root, inventory, metadata) {
  if (
    inventory?.schemaVersion !== 1 ||
    !Array.isArray(inventory.packages) ||
    !inventory.packages.length
  )
    throw Error("Missing vendored source inventory.");
  const reviewed = new Set();
  for (const item of inventory.packages) {
    if (
      !/^[a-z0-9_-]+$/.test(item.name) ||
      !/^\d+\.\d+\.\d+$/.test(item.version) ||
      !/^[a-f0-9]{64}$/.test(item.archiveSha256) ||
      !item.path?.startsWith("vendor/") ||
      !Array.isArray(item.patches) ||
      !item.patches.length ||
      !Array.isArray(item.advisories)
    )
      throw Error("Invalid vendored package identity/provenance.");
    const key = `${item.name}@${item.version}`;
    if (reviewed.has(key)) throw Error(`Duplicate inventory: ${key}`);
    reviewed.add(key);
    const directory = confined(root, item.path);
    if (!(await lstat(directory)).isDirectory()) throw Error(`Invalid source directory: ${key}`);
    const packages = metadata.packages.filter(
      (p) => p.name === item.name && p.version === item.version,
    );
    if (
      packages.length !== 1 ||
      packages[0].source !== null ||
      resolve(packages[0].manifest_path) !== join(directory, "Cargo.toml")
    )
      throw Error(`Cargo does not resolve the reviewed source: ${key}`);
    const actual = await inventoryFiles(directory);
    if (
      !item.files ||
      Object.keys(actual).length !== Object.keys(item.files).length ||
      Object.entries(actual).some(([file, hash]) => item.files[file] !== hash)
    )
      throw Error(`Vendored content changed: ${key}`);
    if (
      !item.upstreamFiles ||
      Object.keys(actual).length !== Object.keys(item.upstreamFiles).length ||
      Object.keys(actual).some((file) => !item.upstreamFiles[file])
    )
      throw Error(`Incomplete upstream provenance: ${key}`);
    for (const patch of item.patches)
      if (
        !/^[a-f0-9]{40}$/.test(patch.upstreamCommit) ||
        digest(await readFile(confined(root, patch.path))) !== patch.sha256
      )
        throw Error(`Backport patch changed: ${key}`);
    for (const advisory of item.advisories)
      if (!/^RUSTSEC-\d{4}-\d{4}$/.test(advisory.id) || !advisory.localStatus || !advisory.evidence)
        throw Error(`Unreviewed advisory disposition: ${key}`);
  }
  for (const item of metadata.packages)
    if (
      item.source === null &&
      !metadata.workspace_members.includes(item.id) &&
      !reviewed.has(`${item.name}@${item.version}`)
    )
      throw Error(`Uninventoried local dependency: ${item.name}@${item.version}`);
  return inventory;
}
/** Synthetic registry inventory of real upstream identities, never a production lockfile. */
export function registryInventoryLock(inventory) {
  return (
    "version = 4\n\n" +
    inventory.packages
      .map(
        (p) =>
          `[[package]]\nname = ${JSON.stringify(p.name)}\nversion = ${JSON.stringify(p.version)}\nsource = "registry+https://github.com/rust-lang/crates.io-index"\nchecksum = ${JSON.stringify(p.archiveSha256)}\n`,
      )
      .join("\n")
  );
}
function entries(report) {
  if (!report?.vulnerabilities || !Array.isArray(report.vulnerabilities.list) || !report.warnings)
    throw Error("Incomplete Cargo audit report.");
  return [
    ...report.vulnerabilities.list.map((row) => ({ ...row, kind: "vulnerability" })),
    ...Object.entries(report.warnings).flatMap(([kind, rows]) =>
      rows.map((row) => ({ ...row, kind })),
    ),
  ];
}
/** Keep all upstream matches visible; new/unmapped source advisories fail revalidation. */
export function assessVendorAdvisories(normal, upstream, inventory) {
  const rows = entries(normal).map((row) => ({ ...row, scope: "resolved registry" }));
  const unassessed = [];
  const matched = new Set();
  for (const row of entries(upstream)) {
    const item = inventory.packages.find(
      (p) => p.name === row.package.name && p.version === row.package.version,
    );
    const disposition = item?.advisories.find((a) => a.id === row.advisory.id);
    if (!disposition) unassessed.push(row.advisory.id);
    matched.add(`${row.package.name}@${row.package.version}:${row.advisory.id}`);
    rows.push({
      ...row,
      scope: "vendored upstream identity",
      localStatus: disposition?.localStatus ?? "UNASSESSED",
      evidence: disposition?.evidence,
    });
  }
  for (const p of inventory.packages)
    for (const a of p.advisories)
      if (!matched.has(`${p.name}@${p.version}:${a.id}`))
        unassessed.push(`Reassess changed advisory metadata: ${p.name}@${p.version}:${a.id}`);
  return {
    rows,
    unassessed,
    failed: rows.some((r) => r.kind === "vulnerability") || unassessed.length > 0,
  };
}
function run(args, root) {
  const result = spawnSync("cargo", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.signal || ![0, 1].includes(result.status))
    throw Error(result.error?.message ?? result.stderr ?? "Cargo failed.");
  if (result.stderr.trim()) console.error(result.stderr.trim());
  return { report: JSON.parse(result.stdout), exit: result.status };
}
/** Fresh normal audit plus same-database upstream-identity scan for verified local sources. */
export async function auditDependencies(root, inventory, command = run) {
  const temp = await mkdtemp(join(tmpdir(), "phemios-vendor-audit-"));
  try {
    const file = join(temp, "upstream-identities.lock");
    await writeFile(file, registryInventoryLock(inventory));
    // Both scans use one private database; --no-fetch omits revision fields in its JSON.
    const database = join(temp, "advisory-db");
    const normal = command(
      ["audit", "--db", database, "--json", "--file", join(root, "Cargo.lock")],
      root,
    );
    const upstream = command(
      ["audit", "--db", database, "--no-fetch", "--json", "--file", file],
      root,
    );
    const assessed = assessVendorAdvisories(normal.report, upstream.report, inventory);
    const report = {
      ...assessed,
      date: new Date().toISOString(),
      databaseRevision: normal.report.database?.["last-commit"],
      normal,
      upstream,
    };
    const output = join(root, "target/quality/vendor-audit");
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
    for (const row of report.rows)
      console.log(
        `${row.advisory.id} ${row.package.name}@${row.package.version} [${row.kind}; ${row.scope}]${row.localStatus ? ` — ${row.localStatus}; ${row.evidence}` : ""}`,
      );
    for (const issue of report.unassessed) console.error(issue);
    console.log(
      `Registry vulnerability matches: ${normal.report.vulnerabilities.count}. Local-source upstream advisories remain visible; this is not Linux or full-product clearance.`,
    );
    return report.failed || normal.exit !== 0 || upstream.exit !== 0 ? 1 : 0;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(import.meta.dirname, "..");
    const inventory = JSON.parse(await readFile(join(root, "vendor/manifest.json"), "utf8"));
    const result = spawnSync(
      "cargo",
      ["metadata", "--locked", "--offline", "--format-version", "1"],
      { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
    if (result.status !== 0) throw Error(result.stderr || "Locked Cargo metadata failed.");
    await verifyVendoredSources(root, inventory, JSON.parse(result.stdout));
    console.log("Vendored source provenance and locked Cargo resolution verified.");
    if (process.argv.includes("--verify-only")) process.exitCode = 0;
    else process.exitCode = await auditDependencies(root, inventory);
  } catch (error) {
    console.error(`Vendored dependency check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
