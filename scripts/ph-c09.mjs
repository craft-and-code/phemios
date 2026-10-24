// Entry point for the frozen PH-C09 validation kit. See docs/quality/ph-c09-validation.md.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type, release as osRelease, version as osVersion } from "node:os";
import {
  assertNativeHost,
  assertNativePlatform,
  buildPlan,
  commandEnvironment,
  help,
  parseOptions,
} from "./ph-c09-policy.mjs";
import { captureCandidate } from "./ph-c09-candidate.mjs";
import { createEvidence, executePlan } from "./ph-c09-evidence.mjs";
export { parseOptions, buildPlan, assertNativeHost } from "./ph-c09-policy.mjs";

function probeRust({ root, env }) {
  const records = [];
  for (const [command, args] of [
    ["rustc", ["-vV"]],
    ["cargo", ["-vV"]],
    ["rustdoc", ["--version"]],
  ]) {
    const startedAt = new Date().toISOString();
    const result = spawnSync(command, args, {
      cwd: root,
      env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    if (result.error || result.signal || result.status !== 0)
      throw Error(
        `${command} probe failed (exit ${result.status}, signal ${result.signal}, error ${result.error?.code ?? "none"}); no preparation or evidence directory was created.`,
      );
    records.push({
      command,
      args,
      cwd: root,
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: result.status,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }
  return {
    rustTriple: records[0].stdout.match(/^host: (.+)$/m)?.[1],
    rustRelease: records[0].stdout.match(/^release: (.+)$/m)?.[1],
    cargoRelease: records[1].stdout.match(/^release: (.+)$/m)?.[1],
    rustdocRelease: records[2].stdout.match(/^rustdoc (\S+)/m)?.[1],
    records,
  };
}

/** Injectable ports permit portable refusal/runner tests without executing any native stage. */
export async function main(
  argv,
  {
    root = resolve(import.meta.dirname, ".."),
    host = { platform: process.platform, arch: process.arch },
    env = process.env,
    print = console.log,
    probe = probeRust,
    capture = captureCandidate,
    evidenceFactory = createEvidence,
    runner = executePlan,
  } = {},
) {
  const options = parseOptions(argv);
  if (options.help) {
    print(help);
    return 0;
  }
  const plan = buildPlan(options, { root });
  if (options.mode === "plan") {
    print(JSON.stringify(plan, null, 2));
    return 0;
  }
  assertNativePlatform(options, host);
  const environment = commandEnvironment(plan, env);
  const native = await probe({ root, env: environment, plan });
  assertNativeHost(options, { ...host, ...native });
  const before = capture(root);
  const evidence = evidenceFactory(root, options.evidence, plan, environment);
  try {
    Object.assign(evidence.manifest, {
      host: {
        ...host,
        rustTriple: native.rustTriple,
        rustRelease: native.rustRelease,
        cargoRelease: native.cargoRelease,
        rustdocRelease: native.rustdocRelease,
      },
      operatingSystem: { type: type(), release: osRelease(), version: osVersion() },
      nativeProbes: (native.records ?? []).map((record) => {
        const saved = { ...record };
        for (const kind of ["stdout", "stderr"]) {
          const path = join(evidence.directory, `native-probe-${record.command}.${kind}.log`);
          writeFileSync(path, record[kind], { flag: "wx", mode: 0o600 });
          saved[kind] = { path, sha256: createHash("sha256").update(record[kind]).digest("hex") };
        }
        return saved;
      }),
      candidateBefore: before,
    });
    evidence.save();
    const result = await runner(plan, {
      root,
      env: environment,
      evidence,
      guard: () => capture(root),
    });
    print(
      `Software stage ${result.softwareStatus}; evidence: ${evidence.directory}. PH-C09/manual acceptance remains NOT RUN.${result.retainCheckoutLock ? " Checkout lock retained: interrupted subprocess cleanup needs manual inspection." : ""}`,
    );
    return result.softwareStatus === "PASS" ? 0 : 1;
  } finally {
    if (!evidence.manifest.retainCheckoutLock) evidence.releaseLock();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
