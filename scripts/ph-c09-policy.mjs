// Pure policy: importing/planning this kit never probes tools or changes files.
import { resolve, join } from "node:path";

export const productBaseline = "a08821d8a0b28662035c3988e6c1dae2485380fc";
export const release = Object.freeze({
  tag: "v0.7.3",
  version: "0.7.3",
  revision: "85a557681d1a86a851e4e1cb4f806b41adbfcd87",
});
export const platforms = Object.freeze({
  linux: {
    os: "linux",
    arch: "x64",
    triple: "x86_64-unknown-linux-gnu",
    label: "Linux-x86_64",
    bundles: "appimage,deb,rpm",
  },
  windows: {
    os: "win32",
    arch: "x64",
    triple: "x86_64-pc-windows-msvc",
    label: "Windows-x64",
    bundles: "nsis,msi",
  },
});
export const help = `Usage: node scripts/ph-c09.mjs plan|run --platform linux|windows --stage prepare|gate|audit|package --toolchain stable|1.90.0 --evidence OUTSIDE_REPO_DIRECTORY

plan is pure: no subprocess, filesystem access, or native acceptance.
run requires the matching native x64 OS and Rust host before preparation.
Evidence must be a fresh nonexistent directory with an existing parent outside the repository.
package requires stable and empty target/release/bundle and dist-release directories.
Software success does not approve PH-C09, installed runtime, findings, or release.`;

/** Parse only the fixed validation interface; no arbitrary commands or defaults. */
export function parseOptions(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  const [mode, ...rest] = argv;
  if (!["plan", "run"].includes(mode)) throw Error(help);
  const options = { mode };
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index]?.replace(/^--/, ""),
      value = rest[index + 1];
    if (
      !rest[index]?.startsWith("--") ||
      !["platform", "stage", "toolchain", "evidence"].includes(key) ||
      !value ||
      value.startsWith("--") ||
      key in options
    )
      throw Error("Unknown, repeated, or incomplete option.\n" + help);
    options[key] = value;
  }
  if (
    !Object.hasOwn(platforms, options.platform) ||
    !["prepare", "gate", "audit", "package"].includes(options.stage) ||
    !["stable", "1.90.0"].includes(options.toolchain) ||
    !options.evidence
  )
    throw Error("All platform, stage, toolchain and evidence options are required.\n" + help);
  if (options.stage === "package" && options.toolchain !== "stable")
    throw Error("Packaging requires the stable toolchain.");
  return options;
}

/** Planning is portable and never reads or creates the supplied evidence path. */
export function buildPlan(options, { root = "/repo" } = {}) {
  // Reuse the parser even for programmatic callers, keeping invalid plans unrepresentable.
  parseOptions([
    options.mode,
    ...["platform", "stage", "toolchain", "evidence"].flatMap((key) => [`--${key}`, options[key]]),
  ]);
  const target = platforms[options.platform];
  const command = (id, executable, ...args) => ({ id, command: executable, args });
  const stages = {
    prepare: [
      command("npm-ci", "npm", "ci"),
      command("audio-source", "node", "scripts/audio-source.mjs"),
      command("cargo-fetch", "cargo", "fetch", "--locked"),
    ],
    gate: [command("authoritative-gate", "bash", "tools/check.sh")],
    audit: [
      command("npm-audit", "npm", "audit", "--json", "--audit-level=low"),
      command("cargo-audit", "cargo", "audit", "--json", "--file", "Cargo.lock"),
      command("vendor-audit", "node", "scripts/vendor-audit.mjs"),
    ],
    package: [
      command(
        "native-installers",
        "npx",
        "--no-install",
        "tauri",
        "build",
        "--ci",
        "--bundles",
        target.bundles,
        "--",
        "--locked",
      ),
      command("release-package", "node", "scripts/release.mjs", "package", target.label),
    ],
  };
  return {
    schemaVersion: 1,
    control: "PH-C09",
    baseline: productBaseline,
    release,
    platform: options.platform,
    stage: options.stage,
    toolchain: options.toolchain,
    root: resolve(root),
    evidence: resolve(options.evidence),
    rustTriple: target.triple,
    targetDirectory:
      options.toolchain === "1.90.0"
        ? join(resolve(root), "target", `ph-c09-minimum-${options.platform}`)
        : join(resolve(root), "target"),
    commands: stages[options.stage],
    limits: [
      "Native installed-App/desktop/device/provider acceptance is NOT RUN by this kit.",
      "PH-C09 and finding dispositions require independent evidence review; no campaign or release approval is produced.",
    ],
  };
}

/** Refuse a wrong OS/Node architecture before even a read-only Rust probe. */
export function assertNativePlatform(options, host) {
  const expected = platforms[options.platform];
  if (!expected || host.platform !== expected.os || host.arch !== expected.arch)
    throw Error(`Native ${options.platform} x64 is required; got ${host.platform}/${host.arch}.`);
}

/** A compiler for another target does not establish native-host verification. */
export function assertNativeHost(options, host) {
  assertNativePlatform(options, host);
  if (host.rustTriple !== platforms[options.platform].triple)
    throw Error("Rust host triple does not match the requested native platform.");
  if (
    options.toolchain === "1.90.0" &&
    [host.rustRelease, host.cargoRelease, host.rustdocRelease].some((value) => value !== "1.90.0")
  )
    throw Error("The genuine Rust 1.90.0 compiler is required.");
  if (
    options.toolchain === "stable" &&
    (!/^\d+\.\d+\.\d+$/.test(host.rustRelease ?? "") ||
      host.cargoRelease !== host.rustRelease ||
      host.rustdocRelease !== host.rustRelease)
  )
    throw Error("A stable Rust compiler release is required.");
}

/** Pin source/toolchain/output settings, refusing inherited substitution of this candidate. */
export function commandEnvironment(plan, inherited = {}) {
  const fixed = {
    AEDE_AUDIO_RELEASE: JSON.stringify(release),
    RUSTUP_TOOLCHAIN: plan.toolchain,
    CARGO_TARGET_DIR: plan.targetDirectory,
    CARGO_INCREMENTAL: "0",
    PHEMIOS_REQUIRE_FFMPEG: "1",
  };
  const values = Object.entries(inherited).map(([key, value]) => [key.toUpperCase(), value]);
  for (const key of [
    "PHEMIOS_AEDE_BINARY",
    "PHEMIOS_AEDE_SOURCE",
    "PHEMIOS_TRANSFER_ENGINE",
    "CARGO_BUILD_TARGET",
    "RUSTC",
    "RUSTDOC",
    "RUSTC_WRAPPER",
    "RUSTC_WORKSPACE_WRAPPER",
    "CARGO_BUILD_RUSTC",
    "CARGO_BUILD_RUSTDOC",
    "CARGO_BUILD_RUSTC_WRAPPER",
    "CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER",
    "RUSTC_BOOTSTRAP",
    "RUSTFLAGS",
    "CARGO_ENCODED_RUSTFLAGS",
    "CARGO_BUILD_RUSTFLAGS",
    "RUSTDOCFLAGS",
    "CARGO_ENCODED_RUSTDOCFLAGS",
  ])
    if (values.some(([name, value]) => name === key && value))
      throw Error(`Remove conflicting ${key} before validation.`);
  for (const [key, value] of values)
    if (value && /^(?:CARGO_TARGET_.+_(?:RUSTFLAGS|RUNNER)|CARGO_PROFILE_.+)$/.test(key))
      throw Error(`Remove conflicting ${key} before validation.`);
  for (const key of ["AEDE_AUDIO_RELEASE", "RUSTUP_TOOLCHAIN", "CARGO_TARGET_DIR"])
    if (values.some(([name, value]) => name === key && value && value !== fixed[key]))
      throw Error(`Conflicting ${key} would change validation identity.`);
  return {
    ...Object.fromEntries(
      Object.entries(inherited).filter(([key]) => !Object.hasOwn(fixed, key.toUpperCase())),
    ),
    ...fixed,
  };
}

/** The Windows owned child is the only process tree this kit may terminate. */
export function terminationInvocation(pid, { platform = process.platform } = {}) {
  if (platform !== "win32" || !Number.isSafeInteger(pid) || pid <= 0)
    throw Error("Invalid owned Windows child PID.");
  return { command: "taskkill", args: ["/PID", String(pid), "/T", "/F"] };
}
