import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

export const baseline = "a08821d8a0b28662035c3988e6c1dae2485380fc";
export const stableRelease = {
  tag: "v0.7.3",
  version: "0.7.3",
  revision: "85a557681d1a86a851e4e1cb4f806b41adbfcd87",
};
export const kitPaths = [
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
];
export const hosts = {
  linux: {
    platform: "linux",
    arch: "x64",
    rustTriple: "x86_64-unknown-linux-gnu",
    rustRelease: "1.99.0",
    cargoRelease: "1.99.0",
    rustdocRelease: "1.99.0",
  },
  windows: {
    platform: "win32",
    arch: "x64",
    rustTriple: "x86_64-pc-windows-msvc",
    rustRelease: "1.99.0",
    cargoRelease: "1.99.0",
    rustdocRelease: "1.99.0",
  },
};

/** Give each behavioral case isolated repository and external evidence roots. */
export async function fixture(work) {
  const directory = mkdtempSync(join(tmpdir(), "phemios-ph-c09-"));
  const root = join(directory, "repository");
  const evidence = join(directory, "evidence");
  mkdirSync(root);
  try {
    return await work({ directory, root, evidence });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function write(root, name, contents) {
  const path = join(root, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  return path;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

/** Include relative names and bytes so directory creation and file edits are visible. */
export function snapshot(root) {
  const entries = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(directory, entry.name);
      const name = relative(root, path).split("\\").join("/");
      if (entry.isDirectory()) {
        entries.push([`${name}/`, null]);
        visit(path);
      } else entries.push([name, sha256(readFileSync(path))]);
    }
  };
  visit(root);
  return entries;
}

export function cli(mode, evidence, changes = {}) {
  const options = {
    platform: "linux",
    stage: "gate",
    toolchain: "stable",
    evidence,
    ...changes,
  };
  return [mode, ...Object.entries(options).flatMap(([name, value]) => [`--${name}`, value])];
}

export function nodeCommand(id, source) {
  return { id, command: process.execPath, args: ["-e", source] };
}

function gitTree(files) {
  return Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, contents]) => {
      const bytes = Buffer.from(contents);
      const hash = createHash("sha1")
        .update(Buffer.from(`blob ${bytes.length}\0`))
        .update(bytes)
        .digest("hex");
      return `100644 blob ${hash}\t${name}\0`;
    })
    .join("");
}

/** Model read-only Git metadata while retaining real filesystem/blob verification. */
export function candidateFixture(root, options = {}) {
  const base = options.base ?? {
    "Cargo.toml": "[workspace]\n",
    "Cargo.lock": "locked product dependencies\n",
    "tools/check.sh": "authoritative native gate\n",
    "src/app.ts": "export const product = true;\n",
    "docs/quality/README.md": "quality policy\n",
  };
  const head = options.head ?? base;
  const working = options.working ?? {
    ...Object.fromEntries(kitPaths.map((name) => [name, "validation kit fixture\n"])),
    ...head,
  };
  const headRevision = options.headRevision ?? baseline;
  for (const [name, contents] of Object.entries(working)) write(root, name, contents);
  const calls = [];
  const git = (args) => {
    calls.push(args);
    if (args[0] === "rev-parse" && args.at(-1) === "HEAD") return headRevision;
    if (args[0] === "merge-base") return options.ancestor ?? baseline;
    if (args[0] === "ls-tree") {
      const revision = args.at(-1);
      assert.ok([baseline, "HEAD", headRevision].includes(revision), `Unexpected tree ${revision}`);
      return gitTree(revision === baseline ? base : head);
    }
    if (args[0] === "ls-files") return Object.keys(working).join("\0") + "\0";
    if (args[0] === "diff")
      return (args.includes("--cached") ? (options.indexDirty ?? []) : (options.dirty ?? []))
        .map((name) => `${name}\0`)
        .join("");
    assert.fail(`Unexpected Git operation: ${args.join(" ")}`);
  };
  return { base, head, working, calls, git };
}

/** Model only Windows child events; no native process or taskkill is executed. */
export function windowsCancellation(terminationExit) {
  const signalSource = new EventEmitter();
  const calls = [];
  const killed = [];
  let owned;
  const spawnImpl = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.pid = command === "taskkill" ? 73002 : 73001;
    child.kill = (signal) => {
      killed.push({ pid: child.pid, signal });
      queueMicrotask(() => child.emit("close", null, signal));
      return true;
    };
    if (command === "taskkill") {
      queueMicrotask(() => {
        child.stdout.end(`taskkill fixture exit ${terminationExit}\n`);
        child.emit("close", terminationExit, null);
        if (terminationExit === 0) owned.emit("close", 1, null);
      });
    } else {
      owned = child;
      queueMicrotask(() => {
        child.stdout.write("owned child fixture\n");
        signalSource.emit("SIGTERM");
        signalSource.emit("SIGTERM");
      });
    }
    return child;
  };
  return { spawnImpl, signalSource, calls, killed };
}

/** Model POSIX delivery and child close while descendant cleanup remains unknown. */
export function posixCancellation() {
  const signalSource = new EventEmitter();
  const calls = [];
  const signals = [];
  // An ignored injection cannot signal a real group: this PID exceeds the OS PID range.
  const ownedPid = Number.MAX_SAFE_INTEGER;
  const spawnImpl = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.pid = ownedPid;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    queueMicrotask(() => {
      child.stdout.end("owned POSIX child closed; descendant state unknown\n");
      signalSource.emit("SIGTERM");
      signalSource.emit("SIGTERM");
      child.emit("close", null, "SIGTERM");
    });
    return child;
  };
  const killImpl = (pid, signal) => signals.push({ pid, signal });
  return { signalSource, spawnImpl, killImpl, ownedPid, calls, signals };
}

/** The earlier live probe closed its direct child without proving descendant cleanup. */
export function interruptedOutcome(spec) {
  return {
    ...spec,
    status: "FAIL",
    exitCode: null,
    signal: "SIGTERM",
    requestedSignal: "SIGTERM",
    spawnError: null,
  };
}
