import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareEngine } from "../scripts/prepare-engine.mjs";

const revision = "b".repeat(40);
const release = { tag: "v0.6.2", version: "0.6.2", revision };
async function fixture(work) {
  const root = mkdtempSync(join(tmpdir(), "stable-engine-"));
  const source = join(root, ".audio-source", `aede-${revision}`);
  mkdirSync(join(source, "target", "aarch64-apple-darwin", "release"), { recursive: true });
  const binary = join(
    source,
    "target",
    "aarch64-apple-darwin",
    "release",
    process.platform === "win32" ? "aede.exe" : "aede",
  );
  writeFileSync(binary, "selected stable executable fixture");
  writeFileSync(
    join(root, "engines.required.json"),
    JSON.stringify({ aede: "0.5.0", flaccompagnon: "0.9.6" }),
  );
  const calls = [];
  const run = (command, args, cwd) => {
    calls.push({ command, args, cwd });
    if (command === "rustc") return "host: aarch64-apple-darwin";
    if (command === binary) return JSON.stringify({ aede: "0.6.2", flaccompagnon: "0.9.6" });
    return "";
  };
  try {
    await work({ root, source, binary, calls, run });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("the embedded engine builds offline from the exact prepared client source", async () =>
  fixture(async ({ root, source, calls, run }) => {
    const selected = await prepareEngine({
      root,
      env: { AEDE_AUDIO_RELEASE: JSON.stringify(release) },
      run,
      prepare: async (options) => {
        assert.equal(options.engine, true);
        assert.deepEqual(options.release, release);
        return { ...release, source };
      },
    });
    assert.equal(selected.revision, revision);
    const build = calls.find(({ command }) => command === "cargo");
    assert.equal(build.cwd, source);
    assert.deepEqual(build.args, [
      "build",
      "--release",
      "--locked",
      "--offline",
      "--target",
      "aarch64-apple-darwin",
      "--target-dir",
      join(source, "target"),
      "-p",
      "aede-cli",
    ]);
    const versions = JSON.parse(
      readFileSync(join(root, "src-tauri", "binaries", "versions.json"), "utf8"),
    );
    assert.equal(versions.audio_revision, revision);
    assert.equal(versions.aede, release.version);
  }));

test("unverified binary/source overrides cannot bypass the stable-source update", async () => {
  for (const env of [
    { PHEMIOS_AEDE_BINARY: "/unused/executable" },
    { PHEMIOS_AEDE_SOURCE: "/unused/source" },
  ])
    await assert.rejects(
      prepareEngine({ env, prepare: () => assert.fail("override must be refused first") }),
      /Remove PHEMIOS_AEDE_BINARY/,
    );
});

test("a stale executable cannot be bundled under the selected stable revision", async () =>
  fixture(async ({ root, source, binary, run }) => {
    await assert.rejects(
      prepareEngine({
        root,
        env: {},
        prepare: async () => ({ ...release, source }),
        run: (command, args, cwd) =>
          command === binary
            ? JSON.stringify({ aede: "0.6.1", flaccompagnon: "0.9.6" })
            : run(command, args, cwd),
      }),
      /does not match/,
    );
    assert.ok(!existsSync(join(root, "src-tauri", "binaries", "versions.json")));
  }));

test("custom Cargo output settings cannot bundle a stale cached engine", async () =>
  fixture(async ({ root, source, run }) => {
    const redirected = join(root, "configured-artifacts");
    mkdirSync(join(source, ".cargo"), { recursive: true });
    writeFileSync(
      join(source, ".cargo", "config.toml"),
      '[build]\ntarget-dir="' + redirected.replaceAll("\\", "/") + '"\n',
    );
    const current = "freshly compiled selected source";
    await prepareEngine({
      root,
      env: {},
      prepare: async () => ({ ...release, source }),
      run: (command, args, cwd) => {
        if (command === "cargo" && args[0] === "build") {
          // Model Cargo's configured output unless the native build explicitly overrides it.
          const at = args.indexOf("--target-dir"),
            target = args.indexOf("--target");
          const directory = at < 0 ? redirected : args[at + 1];
          const parts = target < 0 ? [] : [args[target + 1]];
          const output = join(
            directory,
            ...parts,
            "release",
            process.platform === "win32" ? "aede.exe" : "aede",
          );
          mkdirSync(join(directory, ...parts, "release"), { recursive: true });
          writeFileSync(output, current);
          return "";
        }
        if (command.endsWith(process.platform === "win32" ? "aede.exe" : "aede"))
          return JSON.stringify({ aede: release.version, flaccompagnon: "0.9.6" });
        return run(command, args, cwd);
      },
    });
    const output = join(
      root,
      "src-tauri",
      "binaries",
      `phemios-aede-aarch64-apple-darwin${process.platform === "win32" ? ".exe" : ""}`,
    );
    assert.equal(readFileSync(output, "utf8"), current);
  }));
