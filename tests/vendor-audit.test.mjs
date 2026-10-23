import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  verifyVendoredSources,
  assessVendorAdvisories,
  registryInventoryLock,
  auditDependencies,
} from "../scripts/vendor-audit.mjs";

const hash = (s) => createHash("sha256").update(s).digest("hex");
async function fixture(work) {
  const root = await mkdtemp(join(tmpdir(), "vendor-policy-"));
  try {
    await mkdir(join(root, "vendor/glib"), { recursive: true });
    await writeFile(join(root, "vendor/glib/Cargo.toml"), "original source");
    await writeFile(join(root, "vendor/fix.patch"), "reviewed fix");
    const inventory = {
      schemaVersion: 1,
      packages: [
        {
          name: "glib",
          version: "0.18.5",
          path: "vendor/glib",
          archiveSha256: "a".repeat(64),
          files: { "Cargo.toml": hash("original source") },
          upstreamFiles: { "Cargo.toml": hash("original source") },
          patches: [
            {
              path: "vendor/fix.patch",
              sha256: hash("reviewed fix"),
              upstreamCommit: "b".repeat(40),
            },
          ],
          advisories: [
            {
              id: "RUSTSEC-2024-0429",
              localStatus: "Backported; Linux pending",
              evidence: "docs/quality/lot-3a-validation.md",
            },
          ],
        },
      ],
    };
    const metadata = {
      workspace_members: [],
      packages: [
        {
          id: "glib",
          name: "glib",
          version: "0.18.5",
          source: null,
          manifest_path: join(root, "vendor/glib/Cargo.toml"),
        },
      ],
    };
    await work({ root, inventory, metadata });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const clean = () => ({ vulnerabilities: { count: 0, list: [] }, warnings: {} });
function warning(name, id) {
  return { package: { name, version: "0.18.5" }, advisory: { id } };
}

test("vendored provenance accepts only the source Cargo actually resolves", async () =>
  fixture(async ({ root, inventory, metadata }) => {
    await verifyVendoredSources(root, inventory, metadata);
    metadata.packages[0].source = "registry+https://github.com/rust-lang/crates.io-index";
    await assert.rejects(verifyVendoredSources(root, inventory, metadata), /does not resolve/);
  }));
test("missing, changed or extra source files and altered patches fail validation", async () =>
  fixture(async ({ root, inventory, metadata }) => {
    await writeFile(join(root, "vendor/glib/Cargo.toml"), "changed source");
    await assert.rejects(verifyVendoredSources(root, inventory, metadata), /content changed/);
    await writeFile(join(root, "vendor/glib/Cargo.toml"), "original source");
    await writeFile(join(root, "vendor/glib/unreviewed.rs"), "extra");
    await assert.rejects(verifyVendoredSources(root, inventory, metadata), /content changed/);
    await rm(join(root, "vendor/glib/unreviewed.rs"));
    await writeFile(join(root, "vendor/fix.patch"), "different patch");
    await assert.rejects(verifyVendoredSources(root, inventory, metadata), /patch changed/);
    await rm(join(root, "vendor/glib/Cargo.toml"));
    await assert.rejects(verifyVendoredSources(root, inventory, metadata), /content changed/);
  }));
test("unreviewed local dependencies and path escape cannot evade source coverage", async () =>
  fixture(async ({ root, inventory, metadata }) => {
    metadata.packages.push({ id: "hidden", name: "hidden", version: "1.0.0", source: null });
    await assert.rejects(verifyVendoredSources(root, inventory, metadata), /Uninventoried/);
    metadata.packages.pop();
    inventory.packages[0].path = "vendor/../../outside";
    await assert.rejects(
      verifyVendoredSources(root, inventory, metadata),
      /Invalid vendored source path/,
    );
  }));
test("upstream identity inventory retains the real version and registry checksum", async () =>
  fixture(async ({ inventory }) => {
    const lock = registryInventoryLock(inventory);
    assert.match(lock, /name = "glib"\nversion = "0.18.5"/);
    assert.ok(lock.includes(`checksum = "${"a".repeat(64)}"`));
    assert.ok(!lock.includes("0.20.0"));
  }));
test("registry warnings and the local GLib advisory both stay visible", async () =>
  fixture(async ({ inventory }) => {
    const normal = clean(),
      upstream = clean();
    normal.warnings.unmaintained = [warning("proc-macro-error", "RUSTSEC-2024-0370")];
    upstream.warnings.unsound = [warning("glib", "RUSTSEC-2024-0429")];
    const result = assessVendorAdvisories(normal, upstream, inventory);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[1].localStatus, "Backported; Linux pending");
    assert.equal(result.failed, false);
  }));
test("new local-source advisories and disappeared advisory metadata demand review", async () =>
  fixture(async ({ inventory }) => {
    const upstream = clean();
    upstream.warnings.unsound = [warning("glib", "RUSTSEC-2099-0001")];
    const result = assessVendorAdvisories(clean(), upstream, inventory);
    assert.ok(result.failed);
    assert.ok(result.unassessed.includes("RUSTSEC-2099-0001"));
    assert.equal(result.rows[0].localStatus, "UNASSESSED");
    assert.ok(assessVendorAdvisories(clean(), clean(), inventory).failed);
  }));
test("a vulnerability is never cleared by a recorded local warning disposition", async () =>
  fixture(async ({ inventory }) => {
    const upstream = clean();
    upstream.vulnerabilities = { count: 1, list: [warning("glib", "RUSTSEC-2024-0429")] };
    assert.ok(assessVendorAdvisories(clean(), upstream, inventory).failed);
    assert.throws(() => assessVendorAdvisories({}, upstream, inventory), /Incomplete/);
  }));

test("both assessments use one private database despite no-fetch omitting revision metadata", async () =>
  fixture(async ({ root, inventory }) => {
    const calls = [];
    const command = (args) => {
      calls.push(args);
      const report = clean();
      report.database = { "last-commit": args.includes("--no-fetch") ? null : "c".repeat(40) };
      if (args.includes("--no-fetch"))
        report.warnings.unsound = [warning("glib", "RUSTSEC-2024-0429")];
      return { report, exit: 0 };
    };
    assert.equal(await auditDependencies(root, inventory, command), 0);
    assert.equal(calls.length, 2);
    assert.equal(calls[0][calls[0].indexOf("--db") + 1], calls[1][calls[1].indexOf("--db") + 1]);
    assert.ok(!calls[0].includes("--no-fetch"));
    assert.ok(calls[1].includes("--no-fetch"));
  }));

test("a local migration records its actual base revision instead of inventing an upstream fix", async () =>
  fixture(async ({ root, inventory, metadata }) => {
    const item = inventory.packages[0];
    item.upstreamRevision = "c".repeat(40);
    const patch = item.patches[0];
    delete patch.upstreamCommit;
    patch.baseRevision = item.upstreamRevision;
    patch.reason = "Reviewed local migration; no upstream fix commit exists.";
    await verifyVendoredSources(root, inventory, metadata);
    patch.baseRevision = "d".repeat(40);
    await assert.rejects(verifyVendoredSources(root, inventory, metadata), /patch changed/);
    patch.baseRevision = item.upstreamRevision;
    patch.upstreamCommit = "b".repeat(40);
    await assert.rejects(verifyVendoredSources(root, inventory, metadata), /patch changed/);
    delete patch.upstreamCommit;
    patch.reason = "";
    await assert.rejects(verifyVendoredSources(root, inventory, metadata), /patch changed/);
  }));
