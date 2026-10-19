import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { releaseVersion, packageRelease, packages } from "../scripts/release.mjs";
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), "phemios-release-"));
  try {
    mkdirSync(join(root, "src-tauri"));
    mkdirSync(join(root, "target/release/bundle"), { recursive: true });
    const json = (name, data) => writeFileSync(join(root, name), JSON.stringify(data));
    json("package.json", { version: "0.1.0" });
    json("package-lock.json", { version: "0.1.0", packages: { "": { version: "0.1.0" } } });
    json("src-tauri/tauri.conf.json", { version: "0.1.0" });
    writeFileSync(join(root, "Cargo.toml"), '[workspace.package]\nversion = "0.1.0"\n');
    run(root, json);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test("release versions refuse misleading tags and divergent lock metadata", () =>
  fixture((root, json) => {
    assert.equal(releaseVersion(root, "v0.1.0"), "0.1.0");
    assert.throws(() => releaseVersion(root, "v0.2.0"), /tag/);
    json("package-lock.json", { version: "0.1.0", packages: { "": { version: "0.2.0" } } });
    assert.throws(() => releaseVersion(root), /versions must agree/);
  }));
for (const [label, extensions] of Object.entries(packages)) {
  test(`release packages ${label} with exact installer names and checksums`, () =>
    fixture((root) => {
      for (const ext of extensions)
        writeFileSync(join(root, "target/release/bundle", `native${ext}`), "installer fixture");
      const names = packageRelease(root, label, "v0.1.0");
      assert.deepEqual(
        names,
        extensions.map((ext) => `phemios-App-0.1.0-${label}${ext}`),
      );
      assert.equal(readdirSync(join(root, "dist-release")).length, extensions.length * 2);
      for (const name of names) {
        const content = readFileSync(join(root, "dist-release", name));
        assert.equal(content.toString(), "installer fixture");
        const hash = createHash("sha256").update(content).digest("hex");
        assert.equal(
          readFileSync(join(root, "dist-release", `${name}.sha256`), "utf8"),
          `${hash}  ${name}\n`,
        );
      }
      assert.throws(() => packageRelease(root, label), /must be empty/);
    }));
}
test("missing and ambiguous installers never produce a partial release", () =>
  fixture((root) => {
    assert.throws(() => packageRelease(root, "unknown"), /Unknown/);
    assert.throws(() => packageRelease(root, "Windows-x64"), /exactly one/);
    writeFileSync(join(root, "target/release/bundle", "a.dmg"), "one");
    writeFileSync(join(root, "target/release/bundle", "b.dmg"), "two");
    assert.throws(() => packageRelease(root, "macOS-AppleSilicon"), /exactly one/);
  }));
