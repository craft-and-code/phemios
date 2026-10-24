// Command evidence, exclusive lock and interruption handling share one lifecycle.
// This coherent module exceeds the usual 250-line guideline to keep failure cleanup together.
import { spawn } from "node:child_process";
import { terminationInvocation } from "./ph-c09-policy.mjs";
export { terminationInvocation } from "./ph-c09-policy.mjs";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { join, resolve, delimiter } from "node:path";
import {
  captureCandidate,
  assertCandidateUnchanged,
  validateEvidencePath,
  requireEmpty,
  retainArtifacts,
} from "./ph-c09-candidate.mjs";

const environmentKeys = [
  "AEDE_AUDIO_RELEASE",
  "RUSTUP_TOOLCHAIN",
  "CARGO_TARGET_DIR",
  "CARGO_INCREMENTAL",
  "PHEMIOS_REQUIRE_FFMPEG",
];

/** Exclusive checkout lock plus a never-reused external run directory. No user file is removed. */
export function createEvidence(root, directory, plan, env) {
  directory = validateEvidencePath(root, directory);
  mkdirSync(directory);
  const lockDirectory = join(realpathSync(root), ".audio-source");
  if (!existsSync(lockDirectory)) mkdirSync(lockDirectory);
  if (realpathSync(lockDirectory) !== lockDirectory || !lstatSync(lockDirectory).isDirectory())
    throw Error("Audio cache must be a real directory.");
  const lock = join(lockDirectory, "ph-c09.lock"),
    runId = randomUUID();
  const manifest = {
    schemaVersion: 1,
    control: "PH-C09",
    runId,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    softwareStatus: "RUNNING",
    acceptance: {
      phC09: "NOT RUN",
      installedApp: "NOT RUN",
      findings: "NOT RUN",
      desktopDevicesProviders: "NOT RUN",
      releaseApproval: "NOT RUN",
    },
    plan,
    environment: Object.fromEntries(
      environmentKeys.filter((key) => env[key] !== undefined).map((key) => [key, env[key]]),
    ),
    tools: [],
    commands: plan.commands.map((spec) => ({ ...spec, status: "NOT RUN" })),
  };
  const save = () => {
    const temporary = join(directory, "manifest.json.tmp");
    writeFileSync(temporary, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
    renameSync(temporary, join(directory, "manifest.json"));
  };
  try {
    const handle = openSync(lock, "wx", 0o600);
    try {
      writeFileSync(handle, JSON.stringify({ runId, pid: process.pid, directory }));
    } finally {
      closeSync(handle);
    }
  } catch (error) {
    manifest.softwareStatus = "FAIL";
    manifest.finishedAt = new Date().toISOString();
    manifest.failure = "Checkout validation lock is unavailable; no stage executed.";
    save();
    throw Error("Another PH-C09 run is active or its lock needs manual inspection.", {
      cause: error,
    });
  }
  save();
  return {
    directory,
    manifest,
    save,
    releaseLock() {
      if (JSON.parse(readFileSync(lock, "utf8")).runId !== runId)
        throw Error("Validation lock ownership changed; lock retained.");
      unlinkSync(lock);
    },
  };
}

/** Native Windows npm/npx use their JavaScript entry point; never quote an unsafe cmd shell. */
export function commandInvocation(
  spec,
  { platform = process.platform, env = process.env, execPath = process.execPath } = {},
) {
  if (spec.command === "node") return { command: execPath, args: spec.args };
  if (platform !== "win32" || !["npm", "npx"].includes(spec.command))
    return { command: spec.command, args: spec.args };
  const path = Object.entries(env).find(([key]) => key.toLowerCase() === "path")?.[1] ?? "";
  for (const directory of path.split(platform === process.platform ? delimiter : ";")) {
    if (!directory) continue;
    const cli = join(directory, "node_modules", "npm", "bin", `${spec.command}-cli.js`);
    if (
      existsSync(join(directory, `${spec.command}.cmd`)) &&
      existsSync(cli) &&
      lstatSync(cli).isFile()
    )
      return { command: execPath, args: [cli, ...spec.args] };
  }
  throw Error(
    `Native Windows ${spec.command}.cmd needs the standard adjacent npm JavaScript entry point on PATH.`,
  );
}

/** Stream complete bytes to separate logs; retain actual exit, signal and spawn failure. */
export async function executeCommand(
  spec,
  {
    cwd,
    env,
    directory,
    spawnImpl = spawn,
    killImpl = process.kill,
    platform = process.platform,
    signalSource = process,
    handleSignals = true,
  } = {},
) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(spec.id) || !Array.isArray(spec.args))
    throw Error("Invalid evidence command specification.");
  const record = {
    ...spec,
    cwd: resolve(cwd),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    signal: null,
    spawnError: null,
    requestedSignal: null,
    status: "RUNNING",
  };
  const streams = Object.fromEntries(
    ["stdout", "stderr"].map((kind) => {
      const path = join(directory, `${spec.id}.${kind}.log`);
      return [kind, { path, fd: openSync(path, "wx", 0o600), hash: createHash("sha256") }];
    }),
  );
  try {
    record.invocation = commandInvocation(spec, { env, platform });
    let termination = Promise.resolve();
    await new Promise((done) => {
      let child;
      const interrupt = (signal) => {
        if (record.requestedSignal) return;
        record.requestedSignal = signal;
        if (!child?.pid) return;
        if (platform === "win32") {
          termination = executeCommand(
            { id: `${spec.id}-terminate`, ...terminationInvocation(child.pid, { platform }) },
            { cwd, env, directory, spawnImpl, platform, signalSource, handleSignals: false },
          ).then((result) => {
            record.termination = { ...result, descendantCleanup: "NOT PROVEN" };
            if (result.status !== "PASS") child.kill(signal);
          });
        } else {
          record.termination = {
            method: "posix-process-group-signal",
            processGroup: child.pid,
            signal,
            signalSent: false,
            descendantCleanup: "NOT PROVEN",
            status: "NOT PROVEN",
          };
          try {
            killImpl(-child.pid, signal);
            record.termination.signalSent = true;
          } catch (error) {
            record.termination.error = error.message;
            if (error.code !== "ESRCH") record.termination.status = "FAIL";
          }
        }
      };
      const onInt = () => interrupt("SIGINT"),
        onTerm = () => interrupt("SIGTERM");
      const cleanup = () => {
        signalSource.off("SIGINT", onInt);
        signalSource.off("SIGTERM", onTerm);
        done();
      };
      if (handleSignals) {
        signalSource.on("SIGINT", onInt);
        signalSource.on("SIGTERM", onTerm);
      }
      try {
        child = spawnImpl(record.invocation.command, record.invocation.args, {
          cwd,
          env,
          shell: false,
          detached: platform !== "win32",
          stdio: ["ignore", "pipe", "pipe"],
        });
        for (const kind of ["stdout", "stderr"])
          child[kind].on("data", (bytes) => {
            writeSync(streams[kind].fd, bytes);
            streams[kind].hash.update(bytes);
          });
        child.on("error", (error) => {
          record.spawnError = { code: error.code ?? null, message: error.message };
        });
        child.on("close", (code, signal) => {
          record.exitCode = code;
          record.signal = signal;
          cleanup();
        });
      } catch (error) {
        record.spawnError = { code: error.code ?? null, message: error.message };
        cleanup();
      }
    });
    await termination;
  } catch (error) {
    record.spawnError = { code: error.code ?? null, message: error.message };
  } finally {
    for (const [kind, stream] of Object.entries(streams)) {
      closeSync(stream.fd);
      record[kind] = { path: stream.path, sha256: stream.hash.digest("hex") };
    }
  }
  record.finishedAt = new Date().toISOString();
  record.status =
    record.exitCode === 0 && !record.signal && !record.spawnError && !record.requestedSignal
      ? "PASS"
      : "FAIL";
  return record;
}

/** Stop on the first failure; untouched later commands remain explicitly NOT RUN. */
export async function executePlan(
  plan,
  { root, env, evidence, guard = () => captureCandidate(root), execute = executeCommand } = {},
) {
  const manifest = evidence.manifest;
  const initial = manifest.candidateBefore ?? guard();
  manifest.candidateBefore = initial;
  const inspect = () => {
    const candidate = guard();
    assertCandidateUnchanged(initial, candidate);
    return candidate;
  };
  const run = async (spec, collection, index) => {
    const before = inspect();
    collection[index] = { ...spec, status: "RUNNING", candidateBefore: before };
    evidence.save();
    const record = await execute(spec, { cwd: root, env, directory: evidence.directory });
    collection[index] = {
      ...record,
      status: record.requestedSignal ? "FAIL" : record.status,
      candidateBefore: before,
    };
    // A signal/closed parent pipe (or taskkill exit 0) does not prove descendants stopped.
    if (record.requestedSignal || record.termination?.status === "FAIL")
      manifest.retainCheckoutLock = true;
    evidence.save();
    collection[index].candidateAfter = inspect();
    evidence.save();
    if (collection[index].status !== "PASS")
      throw Error(`${spec.id} failed; later commands were not run.`);
  };
  try {
    // Versions/prerequisites are evidence commands, not an assumption from the selected label.
    const tools = [
      ["node", "--version"],
      ["npm", "--version"],
      ["git", "--version"],
      ["cargo", "--version"],
      ["rustc", "-vV"],
      ["bash", "--version"],
    ];
    if (plan.stage === "gate") tools.push(["ffmpeg", "-version"], ["ffprobe", "-version"]);
    if (plan.stage === "audit") tools.push(["cargo", "audit", "--version"]);
    manifest.tools = tools.map(([command, ...args], index) => ({
      id: `tool-${index}-${command}`,
      command,
      args,
      status: "NOT RUN",
    }));
    for (let index = 0; index < manifest.tools.length; index++)
      await run(manifest.tools[index], manifest.tools, index);
    if (plan.stage === "package") {
      requireEmpty(root, "target/release/bundle");
      requireEmpty(root, "dist-release");
    }
    for (let index = 0; index < plan.commands.length; index++)
      await run(plan.commands[index], manifest.commands, index);
    retainArtifacts(plan, root, evidence);
    manifest.candidateAfter = inspect();
    manifest.softwareStatus = "PASS";
  } catch (error) {
    manifest.softwareStatus = "FAIL";
    manifest.failure = error.message;
    try {
      manifest.candidateAfter = guard();
    } catch (failure) {
      manifest.candidateFailure = failure.message;
    }
  } finally {
    manifest.finishedAt = new Date().toISOString();
    evidence.save();
  }
  return manifest;
}
