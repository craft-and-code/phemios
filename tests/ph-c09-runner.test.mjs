import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { main } from "../scripts/ph-c09.mjs";
import { buildPlan, commandEnvironment, parseOptions } from "../scripts/ph-c09-policy.mjs";
import { captureCandidate, validateEvidencePath } from "../scripts/ph-c09-candidate.mjs";
import {
  commandInvocation,
  createEvidence,
  executeCommand,
  executePlan,
  terminationInvocation,
} from "../scripts/ph-c09-evidence.mjs";
import {
  baseline,
  stableRelease,
  windowsCancellation,
  posixCancellation,
  interruptedOutcome,
  cli,
  hosts,
  fixture,
  write,
  sha256,
  snapshot,
  nodeCommand,
  candidateFixture,
} from "./ph-c09-fixtures.mjs";

const forbidden = () => assert.fail("This refused run must not reach a later port");
function planFor(root, evidence, commands, stage = "prepare") {
  return { ...buildPlan(parseOptions(cli("run", evidence, { stage })), { root }), commands };
}

/** Native version/probe commands are explicitly replaced by harmless fixture children. */
async function fixtureCommand(spec, context) {
  if (spec.id.startsWith("tool-"))
    return executeCommand(
      nodeCommand(
        spec.id,
        'process.stdout.write("fixture tool identity; no native validation\\n")',
      ),
      context,
    );
  return executeCommand(spec, context);
}

async function withEvidence({ root, evidence: directory }, commands, work, stage = "prepare") {
  const state = candidateFixture(root);
  write(root, ".audio-source/selection.json", JSON.stringify(stableRelease));
  const candidate = captureCandidate(root, { git: state.git });
  const plan = planFor(root, directory, commands, stage);
  const env = commandEnvironment(plan, {});
  const evidence = createEvidence(root, directory, plan, env);
  try {
    return await work({ plan, env, evidence, candidate, guard: () => structuredClone(candidate) });
  } finally {
    evidence.releaseLock();
  }
}

function assertLog(record, kind, expected) {
  const bytes = readFileSync(record[kind].path);
  assert.deepEqual(bytes, Buffer.from(expected));
  assert.equal(record[kind].sha256, sha256(bytes));
}

test("PH-C09 rejects repository, reused and symlinked evidence destinations without writes", async () =>
  fixture(async ({ directory, root, evidence }) => {
    write(root, "sentinel.txt", "original product bytes");
    mkdirSync(evidence);
    write(evidence, "sentinel.txt", "prior evidence remains");
    const alias = join(directory, "repository-alias");
    symlinkSync(root, alias, process.platform === "win32" ? "junction" : "dir");
    const before = snapshot(root);
    for (const unsafe of [
      root,
      join(root, "nested-evidence"),
      evidence,
      join(alias, "escaped-evidence"),
    ]) {
      assert.throws(() => validateEvidencePath(root, unsafe), /outside|already exists|repository/i);
      const plan = planFor(root, unsafe, []);
      assert.throws(
        () => createEvidence(root, unsafe, plan, {}),
        /outside|already exists|repository/i,
      );
      assert.deepEqual(snapshot(root), before);
    }
    assert.equal(readFileSync(join(evidence, "sentinel.txt"), "utf8"), "prior evidence remains");
    assert.equal(existsSync(join(root, "escaped-evidence")), false);
  }));

test("PH-C09 Windows npm/npx use adjacent JavaScript entry points without a cmd shell", async () =>
  fixture(async ({ directory }) => {
    const bin = join(directory, "Node tools with spaces");
    for (const name of ["npm", "npx"]) {
      write(bin, `${name}.cmd`, "fixture batch shim; never executed");
      const entry = write(
        bin,
        `node_modules/npm/bin/${name}-cli.js`,
        "fixture JS entry; never executed",
      );
      const args = ["run", "literal argument with spaces & ; $(unchanged)"];
      assert.deepEqual(
        commandInvocation(
          { command: name, args },
          { platform: "win32", env: { Path: bin }, execPath: process.execPath },
        ),
        { command: process.execPath, args: [entry, ...args] },
      );
    }
    const missing = join(directory, "missing-js-entry");
    write(missing, "npm.cmd", "only a batch shim");
    assert.throws(
      () =>
        commandInvocation(
          { command: "npm", args: ["--version"] },
          { platform: "win32", env: { PATH: missing } },
        ),
      /JavaScript|entry point|npm/i,
    );
    assert.deepEqual(
      commandInvocation({ command: "cargo", args: ["--version"] }, { platform: "win32", env: {} }),
      { command: "cargo", args: ["--version"] },
    );
  }));

test("PH-C09 captures actual stdout/stderr bytes, hashes, invocation and exit without shell parsing", async () =>
  fixture(async ({ root, evidence }) => {
    mkdirSync(evidence);
    const output = Buffer.from([0, 1, 65, 10, 255]);
    const error = "diagnostic é\n";
    const spec = nodeCommand(
      "real-node-success",
      `process.stdout.write(Buffer.from([${[...output]}])); process.stderr.write(${JSON.stringify(error)});`,
    );
    let invoked = false;
    const record = await executeCommand(spec, {
      cwd: root,
      env: process.env,
      directory: evidence,
      spawnImpl(command, args, options) {
        invoked = true;
        assert.equal(options.shell, false);
        assert.deepEqual([command, args], [process.execPath, spec.args]);
        return spawn(command, args, options);
      },
    });
    assert.equal(invoked, true);
    assert.equal(record.status, "PASS");
    assert.equal(record.exitCode, 0);
    assert.equal(record.signal, null);
    assert.equal(record.spawnError, null);
    assert.deepEqual(record.invocation, { command: process.execPath, args: spec.args });
    assert.ok(Date.parse(record.finishedAt) >= Date.parse(record.startedAt));
    assertLog(record, "stdout", output);
    assertLog(record, "stderr", error);
  }));

test("PH-C09 records a real spawn error instead of substituting a successful exit", async () =>
  fixture(async ({ root, evidence }) => {
    mkdirSync(evidence);
    const record = await executeCommand(
      { id: "missing-executable", command: join(root, "does-not-exist"), args: [] },
      { cwd: root, env: process.env, directory: evidence },
    );
    assert.equal(record.status, "FAIL");
    assert.equal(record.spawnError.code, "ENOENT");
    assert.notEqual(record.exitCode, 0);
    assertLog(record, "stdout", "");
    assertLog(record, "stderr", "");
  }));

for (const failure of ["exit", "spawn", "signal"]) {
  test(
    `PH-C09 ${failure} failure retains actual evidence and leaves later steps NOT RUN`,
    {
      skip:
        failure === "signal" && process.platform === "win32"
          ? "Real POSIX self-signal evidence requires a Unix host; Windows execution remains unvalidated"
          : false,
    },
    async () =>
      fixture(async ({ root, evidence }) => {
        const first =
          failure === "spawn"
            ? { id: "failing-command", command: join(root, "no-such-executable"), args: [] }
            : nodeCommand(
                "failing-command",
                failure === "exit"
                  ? 'process.stdout.write("before failure\\n"); process.stderr.write("deliberate fixture refusal\\n"); process.exitCode = 7;'
                  : 'process.stdout.write("before signal\\n"); process.kill(process.pid, "SIGTERM");',
              );
        const marker = join(root, "later-command-ran");
        const later = nodeCommand(
          "must-not-run",
          `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "unexpected mutation")`,
        );
        await withEvidence(
          { root, evidence },
          [first, later],
          async ({ plan, env, evidence: state, guard, candidate }) => {
            const manifest = await executePlan(plan, {
              root,
              env,
              evidence: state,
              guard,
              execute: fixtureCommand,
            });
            assert.equal(manifest.softwareStatus, "FAIL");
            assert.equal(manifest.commands[0].status, "FAIL");
            assert.equal(manifest.commands[1].status, "NOT RUN");
            assert.equal(existsSync(marker), false);
            assert.deepEqual(manifest.commands[0].candidateBefore, candidate);
            assert.deepEqual(manifest.commands[0].candidateAfter, candidate);
            assert.equal(
              manifest.tools.every(({ status }) => status === "PASS"),
              true,
            );
            const record = manifest.commands[0];
            if (failure === "exit") {
              assert.equal(record.exitCode, 7);
              assert.equal(record.signal, null);
              assertLog(record, "stdout", "before failure\n");
              assertLog(record, "stderr", "deliberate fixture refusal\n");
            } else if (failure === "spawn") assert.equal(record.spawnError.code, "ENOENT");
            else {
              assert.equal(record.exitCode, null);
              assert.equal(record.signal, "SIGTERM");
              assertLog(record, "stdout", "before signal\n");
            }
            assert.deepEqual(
              JSON.parse(readFileSync(join(evidence, "manifest.json"), "utf8")),
              manifest,
            );
            assert.equal(
              Object.values(manifest.acceptance).every((status) => status === "NOT RUN"),
              true,
            );
          },
        );
      }),
  );
}

test("PH-C09 successful fixture software commands never complete overall or manual acceptance", async () =>
  fixture(async ({ root, evidence }) => {
    const commands = [
      nodeCommand("first-step", 'process.stdout.write("actual first command\\n")'),
      nodeCommand("second-step", 'process.stderr.write("actual second diagnostic\\n")'),
    ];
    await withEvidence(
      { root, evidence },
      commands,
      async ({ plan, env, evidence: state, guard, candidate }) => {
        const manifest = await executePlan(plan, {
          root,
          env,
          evidence: state,
          guard,
          execute: fixtureCommand,
        });
        assert.equal(manifest.control, "PH-C09");
        assert.equal(manifest.softwareStatus, "PASS");
        assert.deepEqual(manifest.candidateBefore, candidate);
        assert.deepEqual(manifest.candidateAfter, candidate);
        assert.equal(manifest.candidateBefore.baseline, baseline);
        assert.equal(
          manifest.commands.every(({ status }) => status === "PASS"),
          true,
        );
        assertLog(manifest.commands[0], "stdout", "actual first command\n");
        assertLog(manifest.commands[1], "stderr", "actual second diagnostic\n");
        for (const record of [...manifest.tools, ...manifest.commands]) {
          assert.equal(record.stdout.sha256, sha256(readFileSync(record.stdout.path)));
          assert.equal(record.stderr.sha256, sha256(readFileSync(record.stderr.path)));
          assert.deepEqual(record.candidateBefore, candidate);
          assert.deepEqual(record.candidateAfter, candidate);
        }
        assert.deepEqual(manifest.acceptance, {
          phC09: "NOT RUN",
          installedApp: "NOT RUN",
          findings: "NOT RUN",
          desktopDevicesProviders: "NOT RUN",
          releaseApproval: "NOT RUN",
        });
        assert.deepEqual(
          JSON.parse(readFileSync(join(evidence, "manifest.json"), "utf8")),
          manifest,
        );
      },
    );
  }));

test("PH-C09 candidate mismatch fails before any tool or stage command", async () =>
  fixture(async ({ root, evidence }) => {
    await withEvidence(
      { root, evidence },
      [nodeCommand("never-run", "process.exit(0)")],
      async ({ plan, env, evidence: state, candidate }) => {
        state.manifest.candidateBefore = candidate;
        const manifest = await executePlan(plan, {
          root,
          env,
          evidence: state,
          guard: () => ({ ...candidate, productDigest: "changed" }),
          execute: forbidden,
        });
        assert.equal(manifest.softwareStatus, "FAIL");
        assert.match(manifest.failure, /candidate|changed/i);
        assert.equal(manifest.commands[0].status, "NOT RUN");
        assert.equal(
          manifest.tools.every(({ status }) => status === "NOT RUN"),
          true,
        );
      },
    );
  }));

test("PH-C09 main binds host, captured probe record, candidate and frozen environment to evidence", async () =>
  fixture(async ({ root, evidence }) => {
    const state = candidateFixture(root);
    const candidate = captureCandidate(root, { git: state.git });
    const probeRecord = {
      command: "rustc",
      args: ["-vV"],
      exitCode: 0,
      stdout: "fixture probe only",
      stderr: "",
    };
    const printed = [];
    const status = await main(cli("run", evidence), {
      root,
      env: { SDKROOT: "/fixture/sdk", GITHUB_TOKEN: "fictional-read-token" },
      host: { platform: "linux", arch: "x64" },
      probe: async () => ({
        rustTriple: hosts.linux.rustTriple,
        rustRelease: hosts.linux.rustRelease,
        cargoRelease: hosts.linux.cargoRelease,
        rustdocRelease: hosts.linux.rustdocRelease,
        records: [probeRecord],
      }),
      capture: () => structuredClone(candidate),
      runner: async (plan, context) => {
        assert.deepEqual(context.evidence.manifest.host, hosts.linux);
        assert.equal(context.evidence.manifest.nativeProbes.length, 1);
        assert.equal(context.evidence.manifest.nativeProbes[0].command, "rustc");
        assertLog(context.evidence.manifest.nativeProbes[0], "stdout", probeRecord.stdout);
        assertLog(context.evidence.manifest.nativeProbes[0], "stderr", probeRecord.stderr);
        assert.deepEqual(context.evidence.manifest.candidateBefore, candidate);
        assert.equal(context.env.PHEMIOS_REQUIRE_FFMPEG, "1");
        assert.equal(context.env.RUSTUP_TOOLCHAIN, "stable");
        assert.equal(context.env.SDKROOT, "/fixture/sdk");
        assert.equal(context.env.GITHUB_TOKEN, "fictional-read-token");
        assert.equal(Object.hasOwn(context.evidence.manifest.environment, "GITHUB_TOKEN"), false);
        assert.equal(Object.hasOwn(context.evidence.manifest.environment, "SDKROOT"), false);
        assert.deepEqual(JSON.parse(context.env.AEDE_AUDIO_RELEASE), plan.release);
        context.evidence.manifest.softwareStatus = "PASS";
        context.evidence.save();
        return context.evidence.manifest;
      },
      print: (message) => printed.push(message),
    });
    assert.equal(status, 0);
    assert.match(printed[0], /PH-C09.*NOT RUN/);
    const manifest = JSON.parse(readFileSync(join(evidence, "manifest.json"), "utf8"));
    assert.equal(manifest.acceptance.phC09, "NOT RUN");
    assert.deepEqual(manifest.host, hosts.linux);
    assert.equal(existsSync(join(root, ".audio-source/ph-c09.lock")), false);
  }));

test("PH-C09 main refuses compiler/candidate mismatch before evidence creation", async () =>
  fixture(async ({ directory, root, evidence }) => {
    write(root, "sentinel.txt", "unchanged");
    const before = snapshot(directory);
    const context = {
      root,
      env: {},
      host: { platform: "linux", arch: "x64" },
      evidenceFactory: forbidden,
      runner: forbidden,
      print: () => {},
    };
    await assert.rejects(
      main(cli("run", evidence), {
        ...context,
        probe: async () => ({ rustTriple: "x86_64-apple-darwin", rustRelease: "1.99.0" }),
        capture: forbidden,
      }),
      /triple/i,
    );
    await assert.rejects(
      main(cli("run", evidence), {
        ...context,
        probe: async () => hosts.linux,
        capture: () => {
          throw Error("Frozen candidate mismatch");
        },
      }),
      /candidate mismatch/,
    );
    assert.deepEqual(snapshot(directory), before);
  }));

test("PH-C09 Windows cancellation names only a validated owned PID and its process tree", () => {
  assert.deepEqual(terminationInvocation(12345, { platform: "win32" }), {
    command: "taskkill",
    args: ["/PID", "12345", "/T", "/F"],
  });
  for (const pid of [0, -1, 1.5, NaN, "12345 & other-command", Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => terminationInvocation(pid, { platform: "win32" }), /PID|owned/i);
  assert.throws(() => terminationInvocation(12345, { platform: "darwin" }), /Windows|PID/i);
});

test("PH-C09 cannot label a minimum run with a newer Cargo as accepted", async () =>
  fixture(async ({ directory, root, evidence }) => {
    const before = snapshot(directory);
    await assert.rejects(
      main(cli("run", evidence, { toolchain: "1.90.0" }), {
        root,
        env: {},
        host: { platform: "linux", arch: "x64" },
        probe: async () => ({
          ...hosts.linux,
          rustRelease: "1.90.0",
          cargoRelease: "1.99.0",
          rustdocRelease: "1.90.0",
        }),
        capture: forbidden,
        evidenceFactory: forbidden,
        runner: forbidden,
        print: () => {},
      }),
      /1\.90\.0|Cargo|toolchain|compiler/i,
    );
    assert.deepEqual(snapshot(directory), before);
  }));

test("PH-C09 mandatory FFmpeg failure blocks the gate and leaves later prerequisites NOT RUN", async () =>
  fixture(async ({ root, evidence }) => {
    await withEvidence(
      { root, evidence },
      [nodeCommand("native-gate-never-run", "process.exit(0)")],
      async ({ plan, env, evidence: state, guard }) => {
        const manifest = await executePlan(plan, {
          root,
          env,
          evidence: state,
          guard,
          execute: async (spec, context) => {
            assert.ok(
              spec.id.startsWith("tool-"),
              "Native gate must not start after a missing mandatory prerequisite",
            );
            return executeCommand(
              nodeCommand(
                spec.id,
                spec.command === "ffmpeg"
                  ? 'process.stderr.write("fixture missing FFmpeg\\n"); process.exitCode = 3;'
                  : 'process.stdout.write("fixture tool only\\n")',
              ),
              context,
            );
          },
        });
        assert.equal(manifest.softwareStatus, "FAIL");
        assert.equal(
          manifest.tools.find(
            ({ command, invocation }) =>
              command === process.execPath && invocation.args[1].includes("missing FFmpeg"),
          ).exitCode,
          3,
        );
        assert.equal(manifest.tools.find(({ command }) => command === "ffprobe").status, "NOT RUN");
        assert.equal(manifest.commands[0].status, "NOT RUN");
        assert.equal(manifest.acceptance.phC09, "NOT RUN");
      },
      "gate",
    );
  }));

test("PH-C09 packaging preserves stale installer files and refuses before bundling", async () =>
  fixture(async ({ root, evidence }) => {
    const old = write(
      root,
      "target/release/bundle/old-installer.deb",
      "pre-existing installer bytes",
    );
    await withEvidence(
      { root, evidence },
      [nodeCommand("bundler-never-run", "process.exit(0)")],
      async ({ plan, env, evidence: state, guard }) => {
        const manifest = await executePlan(plan, {
          root,
          env,
          evidence: state,
          guard,
          execute: async (spec, context) => {
            assert.ok(
              spec.id.startsWith("tool-"),
              "A stale installer must be refused before bundle commands",
            );
            return fixtureCommand(spec, context);
          },
        });
        assert.equal(manifest.softwareStatus, "FAIL");
        assert.match(manifest.failure, /empty|bundle/i);
        assert.equal(manifest.commands[0].status, "NOT RUN");
        assert.equal(readFileSync(old, "utf8"), "pre-existing installer bytes");
      },
      "package",
    );
  }));

for (const terminationExit of [0, 5]) {
  test(`PH-C09 Windows cancellation model records subtree termination exit ${terminationExit}`, async () =>
    fixture(async ({ root, evidence }) => {
      mkdirSync(evidence);
      const model = windowsCancellation(terminationExit);
      const record = await executeCommand(
        nodeCommand("cancelled-fixture", "unused injected fixture"),
        {
          cwd: root,
          env: {},
          directory: evidence,
          platform: "win32",
          spawnImpl: model.spawnImpl,
          signalSource: model.signalSource,
        },
      );
      assert.equal(record.status, "FAIL");
      assert.equal(record.requestedSignal, "SIGTERM");
      assert.equal(record.termination.exitCode, terminationExit);
      assert.equal(record.termination.status, terminationExit === 0 ? "PASS" : "FAIL");
      assertLog(record, "stdout", "owned child fixture\n");
      assertLog(record.termination, "stdout", `taskkill fixture exit ${terminationExit}\n`);
      assert.equal(model.calls.length, 2, "Repeated interruption must not start another taskkill");
      assert.deepEqual(model.calls[1].args, ["/PID", "73001", "/T", "/F"]);
      assert.equal(model.calls[1].command, "taskkill");
      assert.equal(
        model.calls.every(({ options }) => options.shell === false && options.detached === false),
        true,
      );
      assert.equal(model.signalSource.listenerCount("SIGTERM"), 0);
      assert.equal(model.signalSource.listenerCount("SIGINT"), 0);
      assert.deepEqual(
        model.killed,
        terminationExit === 0 ? [] : [{ pid: 73001, signal: "SIGTERM" }],
      );
    }));
}

test("PH-C09 keeps the checkout lock when the Windows termination model cannot stop a subtree", async () =>
  fixture(async ({ root, evidence }) => {
    const state = candidateFixture(root);
    const candidate = captureCandidate(root, { git: state.git });
    const model = windowsCancellation(5);
    const status = await main(cli("run", evidence), {
      root,
      env: {},
      host: { platform: "linux", arch: "x64" },
      probe: async () => hosts.linux,
      capture: () => structuredClone(candidate),
      print: () => {},
      runner: async (plan, context) =>
        executePlan(plan, {
          ...context,
          execute: (spec, commandContext) =>
            executeCommand(nodeCommand(spec.id, "unused injected fixture"), {
              ...commandContext,
              platform: "win32",
              spawnImpl: model.spawnImpl,
              signalSource: model.signalSource,
            }),
        }),
    });
    assert.equal(status, 1);
    const manifest = JSON.parse(readFileSync(join(evidence, "manifest.json"), "utf8"));
    assert.equal(manifest.softwareStatus, "FAIL");
    assert.equal(manifest.retainCheckoutLock, true);
    assert.equal(
      manifest.commands.every(({ status }) => status === "NOT RUN"),
      true,
    );
    assert.equal(manifest.tools[0].termination.exitCode, 5);
    assert.equal(existsSync(join(root, ".audio-source/ph-c09.lock")), true);
  }));

test("PH-C09 refuses successful commands whose final source selection drifts from the frozen release", async () =>
  fixture(async ({ root, evidence }) => {
    await withEvidence(
      { root, evidence },
      [nodeCommand("successful-fixture", "process.exit(0)")],
      async ({ plan, env, evidence: state, guard }) => {
        write(
          root,
          ".audio-source/selection.json",
          JSON.stringify({ ...stableRelease, revision: "f".repeat(40) }),
        );
        const manifest = await executePlan(plan, {
          root,
          env,
          evidence: state,
          guard,
          execute: fixtureCommand,
        });
        assert.equal(manifest.commands[0].status, "PASS");
        assert.equal(manifest.softwareStatus, "FAIL");
        assert.match(manifest.failure, /source selection|frozen.*release/i);
        assert.equal(manifest.acceptance.phC09, "NOT RUN");
      },
    );
  }));

test("PH-C09 POSIX cancellation records signal delivery without claiming descendant cleanup", async () =>
  fixture(async ({ root, evidence }) => {
    mkdirSync(evidence);
    const model = posixCancellation();
    const record = await executeCommand(
      nodeCommand("posix-cancelled-fixture", "unused injected fixture"),
      {
        cwd: root,
        env: {},
        directory: evidence,
        platform: "linux",
        spawnImpl: model.spawnImpl,
        signalSource: model.signalSource,
        killImpl: model.killImpl,
      },
    );
    assert.equal(record.status, "FAIL");
    assert.equal(record.requestedSignal, "SIGTERM");
    assert.deepEqual(model.signals, [{ pid: -model.ownedPid, signal: "SIGTERM" }]);
    assert.equal(model.calls.length, 1);
    assert.equal(model.calls[0].options.detached, true);
    assert.equal(model.calls[0].options.shell, false);
    assert.equal(record.termination.method, "posix-process-group-signal");
    assert.equal(record.termination.processGroup, model.ownedPid);
    assert.equal(record.termination.signalSent, true);
    assert.equal(record.termination.descendantCleanup, "NOT PROVEN");
    assert.equal(record.termination.status, "NOT PROVEN");
    assertLog(record, "stdout", "owned POSIX child closed; descendant state unknown\n");
    assert.equal(model.signalSource.listenerCount("SIGTERM"), 0);
    assert.equal(model.signalSource.listenerCount("SIGINT"), 0);
  }));

test("PH-C09 POSIX interrupted outcome keeps the checkout lock and later commands NOT RUN", async () =>
  fixture(async ({ root, evidence }) => {
    const state = candidateFixture(root);
    const candidate = captureCandidate(root, { git: state.git });
    const executed = [];
    const status = await main(cli("run", evidence), {
      root,
      env: {},
      host: { platform: "linux", arch: "x64" },
      probe: async () => hosts.linux,
      capture: () => structuredClone(candidate),
      print: () => {},
      runner: async (plan, context) =>
        executePlan(plan, {
          ...context,
          execute: async (spec) => {
            executed.push(spec.id);
            return interruptedOutcome(spec);
          },
        }),
    });
    assert.equal(status, 1);
    const manifest = JSON.parse(readFileSync(join(evidence, "manifest.json"), "utf8"));
    assert.equal(manifest.softwareStatus, "FAIL");
    assert.equal(manifest.tools[0].requestedSignal, "SIGTERM");
    assert.equal(manifest.retainCheckoutLock, true);
    assert.equal(executed.length, 1);
    assert.equal(
      manifest.tools.slice(1).every(({ status }) => status === "NOT RUN"),
      true,
    );
    assert.equal(
      manifest.commands.every(({ status }) => status === "NOT RUN"),
      true,
    );
    assert.equal(manifest.acceptance.phC09, "NOT RUN");
    assert.equal(existsSync(join(root, ".audio-source/ph-c09.lock")), true);
  }));
