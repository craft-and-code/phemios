import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { main } from "../scripts/ph-c09.mjs";
import {
  assertNativeHost,
  buildPlan,
  commandEnvironment,
  parseOptions,
} from "../scripts/ph-c09-policy.mjs";
import { captureCandidate, assertCandidateUnchanged } from "../scripts/ph-c09-candidate.mjs";
import {
  baseline,
  stableRelease,
  kitPaths,
  hosts,
  fixture,
  write,
  snapshot,
  cli,
  candidateFixture,
} from "./ph-c09-fixtures.mjs";

const forbidden = () => assert.fail("A read-only plan must not probe, capture or run commands");

test("PH-C09 refuses missing, repeated, unknown and incompatible CLI selections", () => {
  const valid = cli("plan", "/outside/evidence");
  for (const args of [
    [],
    ["run"],
    ["unknown", ...valid.slice(1)],
    valid.slice(0, -2),
    [...valid, "--platform", "linux"],
    [...valid, "--unknown", "value"],
    [...valid, "extra"],
    cli("plan", "/outside/evidence", { platform: "darwin" }),
    cli("plan", "/outside/evidence", { platform: "Linux" }),
    cli("plan", "/outside/evidence", { stage: "complete" }),
    cli("plan", "/outside/evidence", { toolchain: "nightly" }),
    cli("run", "/outside/evidence", { stage: "package", toolchain: "1.90.0" }),
  ])
    assert.throws(() => parseOptions(args), `Unexpectedly accepted ${args.join(" ")}`);
  assert.doesNotThrow(() => parseOptions(["--help"]));
});

test("PH-C09 plans remain pure on a Mac and create no evidence or cache directories", async () =>
  fixture(async ({ directory, root, evidence }) => {
    write(root, "sentinel.txt", "unchanged bytes");
    const before = snapshot(directory);
    const printed = [];
    const status = await main(cli("plan", evidence), {
      root,
      host: { platform: "darwin", arch: "arm64", rustTriple: "aarch64-apple-darwin" },
      capture: forbidden,
      probe: forbidden,
      runner: forbidden,
      print: (value) => printed.push(value),
    });
    assert.equal(status, 0);
    assert.equal(printed.length, 1);
    assert.deepEqual(snapshot(directory), before);
    assert.equal(existsSync(evidence), false);
  }));

test("PH-C09 rejects unsupported hosts before probing, candidate capture or writes", async () =>
  fixture(async ({ directory, root, evidence }) => {
    write(root, "sentinel.txt", "untouched");
    const before = snapshot(directory);
    for (const host of [
      { platform: "darwin", arch: "arm64" },
      { platform: "linux", arch: "arm64" },
      { platform: "win32", arch: "x64" },
    ]) {
      await assert.rejects(
        main(cli("run", evidence), {
          root,
          host,
          probe: forbidden,
          capture: forbidden,
          runner: forbidden,
          print: () => {},
        }),
        /host|native|platform|architecture|x64/i,
      );
      assert.deepEqual(snapshot(directory), before);
    }
  }));

test("PH-C09 requires the exact native Rust target and genuine minimum toolchain", () => {
  for (const platform of ["linux", "windows"]) {
    const options = parseOptions(cli("run", "/outside/evidence", { platform }));
    assert.doesNotThrow(() => assertNativeHost(options, hosts[platform]));
    for (const rustTriple of ["aarch64-unknown-linux-gnu", "x86_64-apple-darwin", "unknown"])
      assert.throws(() => assertNativeHost(options, { ...hosts[platform], rustTriple }));
    const minimum = parseOptions(
      cli("run", "/outside/evidence", { platform, toolchain: "1.90.0" }),
    );
    assert.doesNotThrow(() =>
      assertNativeHost(minimum, {
        ...hosts[platform],
        rustRelease: "1.90.0",
        cargoRelease: "1.90.0",
        rustdocRelease: "1.90.0",
      }),
    );
    assert.throws(() => assertNativeHost(minimum, { ...hosts[platform], rustRelease: "1.99.0" }));
  }
});

test("PH-C09 plans freeze the reviewed product and actually published shared engine", () => {
  for (const platform of ["linux", "windows"])
    for (const toolchain of ["stable", "1.90.0"])
      for (const stage of ["prepare", "gate", "audit", "package"]) {
        if (stage === "package" && toolchain !== "stable") continue;
        const plan = buildPlan(
          parseOptions(cli("plan", "/outside/evidence", { platform, toolchain, stage })),
          { root: "/fictional/phemios" },
        );
        assert.equal(plan.control, "PH-C09");
        assert.equal(plan.baseline, baseline);
        assert.deepEqual(plan.release, stableRelease);
        assert.equal(plan.platform, platform);
        assert.equal(plan.stage, stage);
        assert.equal(plan.toolchain, toolchain);
        assert.equal(plan.rustTriple, hosts[platform].rustTriple);
        assert.ok(plan.commands.length > 0);
        assert.equal(new Set(plan.commands.map(({ id }) => id)).size, plan.commands.length);
      }
});

test("PH-C09 candidate identity hashes real protected bytes and accepts only exact kit paths", async () => {
  for (const name of kitPaths)
    await fixture(async ({ root }) => {
      const original = candidateFixture(root);
      const before = captureCandidate(root, { git: original.git });
      const next = { ...original.working, [name]: "authorized validation kit overlay\n" };
      const changed = candidateFixture(root, { working: next, dirty: [name] });
      const after = captureCandidate(root, { git: changed.git });
      assert.equal(after.baseline, baseline);
      assert.equal(after.head, baseline);
      assert.equal(after.productDigest, before.productDigest);
      assert.notEqual(after.kitDigest, before.kitDigest);
      assert.equal(after.kitHashes[name].length, 64);
      assert.equal(after.productHashes["src/app.ts"].length, 64);
      assert.ok(
        changed.calls.every((args) =>
          ["rev-parse", "merge-base", "ls-tree", "ls-files", "diff"].includes(args[0]),
        ),
      );
      assert.throws(() => assertCandidateUnchanged(before, after), /candidate|changed|kit|digest/i);
    });
});

test("PH-C09 refuses modified product, authoritative checks, locks and vendor sources", async () => {
  for (const name of [
    "src/app.ts",
    "tools/check.sh",
    "Cargo.toml",
    "Cargo.lock",
    "package.json",
    "package-lock.json",
    "vendor/glib/src/variant.rs",
    "docs/quality/ph-c09-other.md",
    "scripts/ph-c09-extra.mjs",
    "tests/ph-c09-fixtures.mjs.extra",
  ])
    await fixture(async ({ root }) => {
      const original = candidateFixture(root);
      const changed = candidateFixture(root, {
        working: { ...original.working, [name]: "unapproved changed bytes\n" },
        dirty: [name],
      });
      assert.throws(
        () => captureCandidate(root, { git: changed.git }),
        /product|baseline|unauthorized|outside|protected|changed/i,
      );
    });
});

test("PH-C09 cannot hide product drift in a new HEAD, staged files or deleted files", async () =>
  fixture(async ({ root }) => {
    const original = candidateFixture(root);
    const head = { ...original.base, "src/app.ts": "committed unreviewed product\n" };
    const committed = candidateFixture(root, {
      base: original.base,
      head,
      headRevision: "b".repeat(40),
    });
    assert.throws(
      () => captureCandidate(root, { git: committed.git }),
      /product|baseline|changed/i,
    );
    const staged = candidateFixture(root, { indexDirty: ["Cargo.lock"] });
    assert.throws(
      () => captureCandidate(root, { git: staged.git }),
      /product|baseline|changed|dirty/i,
    );
    const deleted = candidateFixture(root);
    rmSync(join(root, "Cargo.lock"));
    assert.throws(() => captureCandidate(root, { git: deleted.git }));
    assert.equal(
      readFileSync(join(root, "tools/check.sh"), "utf8"),
      original.base["tools/check.sh"],
    );
  }));

test("PH-C09 stage commands retain the authoritative gate and exact audit/package interfaces", () => {
  const plan = (platform, stage) =>
    buildPlan(parseOptions(cli("plan", "/outside/evidence", { platform, stage })));
  for (const platform of ["linux", "windows"]) {
    assert.deepEqual(
      plan(platform, "gate").commands.map(({ command, args }) => [command, ...args]),
      [["bash", "tools/check.sh"]],
    );
    assert.deepEqual(
      plan(platform, "prepare").commands.map(({ command, args }) => [command, ...args]),
      [
        ["npm", "ci"],
        ["node", "scripts/audio-source.mjs"],
        ["cargo", "fetch", "--locked"],
      ],
    );
    assert.deepEqual(
      plan(platform, "audit").commands.map(({ command, args }) => [command, ...args]),
      [
        ["npm", "audit", "--json", "--audit-level=low"],
        ["cargo", "audit", "--json", "--file", "Cargo.lock"],
        ["node", "scripts/vendor-audit.mjs"],
      ],
    );
    const packaged = plan(platform, "package").commands;
    assert.deepEqual(packaged[0].args, [
      "--no-install",
      "tauri",
      "build",
      "--ci",
      "--bundles",
      platform === "linux" ? "appimage,deb,rpm" : "nsis,msi",
      "--",
      "--locked",
    ]);
    assert.equal(packaged[0].command, "npx");
    assert.deepEqual(packaged[1].args, [
      "scripts/release.mjs",
      "package",
      platform === "linux" ? "Linux-x86_64" : "Windows-x64",
    ]);
  }
  const authoritative = readFileSync(new URL("../tools/check.sh", import.meta.url), "utf8");
  for (const command of [
    "node scripts/keepawake-regression.mjs --fetch",
    "cargo test -p phemios-glib-regression --release --locked",
    "node scripts/macro-regression.mjs --fetch",
  ])
    assert.ok(authoritative.includes(command), `Linux coverage is absent: ${command}`);
  assert.match(authoritative, /if \[\[ "\$\(uname -s\)" == Linux \]\]; then/);
});

test("PH-C09 fixed environment pins the same published source and refuses inherited substitutes", () => {
  for (const toolchain of ["stable", "1.90.0"]) {
    const plan = buildPlan(parseOptions(cli("plan", "/outside/evidence", { toolchain })), {
      root: "/fictional/phemios",
    });
    const env = commandEnvironment(plan, {
      PATH: "/fixture/tools",
      FICTIONAL_MARKER: "retained",
      SDKROOT: "/fixture/sdk",
      GITHUB_TOKEN: "fictional-read-token",
    });
    assert.deepEqual(JSON.parse(env.AEDE_AUDIO_RELEASE), stableRelease);
    assert.equal(env.RUSTUP_TOOLCHAIN, toolchain);
    assert.equal(env.CARGO_INCREMENTAL, "0");
    assert.equal(env.PHEMIOS_REQUIRE_FFMPEG, "1");
    assert.equal(env.CARGO_TARGET_DIR, plan.targetDirectory);
    assert.equal(env.PATH, "/fixture/tools");
    assert.equal(env.FICTIONAL_MARKER, "retained");
    assert.equal(env.SDKROOT, "/fixture/sdk");
    assert.equal(env.GITHUB_TOKEN, "fictional-read-token");
    if (toolchain === "1.90.0") assert.notEqual(env.CARGO_TARGET_DIR, "/fictional/phemios/target");
    for (const key of [
      "PHEMIOS_AEDE_BINARY",
      "PHEMIOS_AEDE_SOURCE",
      "PHEMIOS_TRANSFER_ENGINE",
      "CARGO_BUILD_TARGET",
      "AEDE_AUDIO_RELEASE",
      "RUSTUP_TOOLCHAIN",
      "CARGO_TARGET_DIR",
    ])
      assert.throws(
        () => commandEnvironment(plan, { [key]: "unreviewed-substitution" }),
        new RegExp(key),
      );
  }
});

test("PH-C09 records a tooling-only descendant HEAD without changing product identity", async () =>
  fixture(async ({ root }) => {
    const original = candidateFixture(root);
    const before = captureCandidate(root, { git: original.git });
    const head = { ...original.base, "scripts/ph-c09.mjs": "committed validation kit fixture\n" };
    const overlay = candidateFixture(root, {
      base: original.base,
      head,
      headRevision: "c".repeat(40),
    });
    const after = captureCandidate(root, { git: overlay.git });
    assert.equal(after.head, "c".repeat(40));
    assert.equal(after.baseline, baseline);
    assert.equal(after.productDigest, before.productDigest);
    assert.notEqual(after.kitDigest, before.kitDigest);
    assert.doesNotThrow(() => assertCandidateUnchanged(after, structuredClone(after)));
  }));

test("PH-C09 refuses a missing kit component, unavailable baseline or unrelated history", async () => {
  await fixture(async ({ root }) => {
    const original = candidateFixture(root);
    rmSync(join(root, "tests/ph-c09-runner.test.mjs"));
    assert.throws(() => captureCandidate(root, { git: original.git }), /kit|missing|ENOENT/i);
  });
  await fixture(async ({ root }) => {
    const unavailable = candidateFixture(root, { base: {} });
    assert.throws(() => captureCandidate(root, { git: unavailable.git }), /baseline|unavailable/i);
  });
  await fixture(async ({ root }) => {
    const unrelated = candidateFixture(root, { ancestor: "d".repeat(40) });
    assert.throws(
      () => captureCandidate(root, { git: unrelated.git }),
      /ancestor|history|baseline/i,
    );
  });
});

test("PH-C09 genuine minimum toolchain rejects independently mismatched Cargo or Rustdoc", () => {
  for (const platform of ["linux", "windows"]) {
    const options = parseOptions(
      cli("run", "/outside/evidence", { platform, toolchain: "1.90.0" }),
    );
    const minimum = {
      ...hosts[platform],
      rustRelease: "1.90.0",
      cargoRelease: "1.90.0",
      rustdocRelease: "1.90.0",
    };
    assert.doesNotThrow(() => assertNativeHost(options, minimum));
    for (const field of ["rustRelease", "cargoRelease", "rustdocRelease"])
      for (const value of [undefined, "1.99.0", "1.90.0-nightly"])
        assert.throws(
          () => assertNativeHost(options, { ...minimum, [field]: value }),
          /compiler|cargo|rustdoc|1\.90\.0|toolchain/i,
        );
  }
});

test("PH-C09 inherited compiler and wrapper substitutions are refused before probing", async () =>
  fixture(async ({ directory, root, evidence }) => {
    const before = snapshot(directory);
    for (const key of [
      "RUSTC",
      "RUSTDOC",
      "RUSTC_WRAPPER",
      "RUSTC_WORKSPACE_WRAPPER",
      "CARGO_BUILD_RUSTC",
      "CARGO_BUILD_RUSTDOC",
      "CARGO_BUILD_RUSTC_WRAPPER",
      "CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER",
    ])
      await assert.rejects(
        main(cli("run", evidence, { toolchain: "1.90.0" }), {
          root,
          env: { [key]: "unverified-compiler" },
          host: { platform: "linux", arch: "x64" },
          probe: forbidden,
          capture: forbidden,
          evidenceFactory: forbidden,
          runner: forbidden,
          print: () => {},
        }),
        new RegExp(key),
      );
    assert.deepEqual(snapshot(directory), before);
  }));

test("PH-C09 build, target-runner, profile and Rustdoc overrides are refused before probing regardless of case", async () =>
  fixture(async ({ directory, root, evidence }) => {
    const before = snapshot(directory);
    for (const key of [
      "CARGO_BUILD_RUSTFLAGS",
      "cargo_build_rustflags",
      "CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUSTFLAGS",
      "Cargo_Target_X86_64_Pc_Windows_Msvc_Runner",
      "CARGO_PROFILE_RELEASE_OPT_LEVEL",
      "cargo_profile_dev_overflow_checks",
      "RUSTDOCFLAGS",
      "rustdocflags",
      "CARGO_ENCODED_RUSTDOCFLAGS",
      "Cargo_Encoded_Rustdocflags",
    ])
      await assert.rejects(
        main(cli("run", evidence, { toolchain: "1.90.0" }), {
          root,
          env: { [key]: "unreviewed-build-or-test-substitution" },
          host: { platform: "linux", arch: "x64" },
          probe: forbidden,
          capture: forbidden,
          evidenceFactory: forbidden,
          runner: forbidden,
          print: () => {},
        }),
        new RegExp(key, "i"),
      );
    assert.deepEqual(snapshot(directory), before);
  }));
