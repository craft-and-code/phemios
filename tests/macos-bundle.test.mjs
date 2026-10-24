import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyMacosApp, verifyMacosDmg } from "../scripts/check-macos-bundle.mjs";

const native = { skip: process.platform !== "darwin" };
const expected = { identifier: "fr.craftandcode.phemios", version: "0.2.0" };
function fixture(check) {
  const root = mkdtempSync(join(tmpdir(), "phemios-signature-test-"));
  try {
    const app = join(root, "Fixture.app");
    const contents = join(app, "Contents");
    mkdirSync(join(contents, "MacOS"), { recursive: true });
    mkdirSync(join(contents, "Resources"));
    writeFileSync(
      join(contents, "Info.plist"),
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${expected.identifier}</string>
<key>CFBundleShortVersionString</key><string>${expected.version}</string>
<key>CFBundleVersion</key><string>${expected.version}</string>
<key>CFBundleExecutable</key><string>phemios</string>
<key>CFBundlePackageType</key><string>APPL</string>
</dict></plist>`,
    );
    const resource = join(contents, "Resources/fixture.txt");
    writeFileSync(resource, "retained resource");
    const source = join(root, "main.c");
    writeFileSync(source, "int main(void) { return 0; }\n");
    const executable = join(contents, "MacOS/phemios");
    const engine = join(contents, "MacOS/phemios-aede");
    execFileSync("clang", [source, "-o", executable]);
    cpSync(executable, engine);
    const sign = () => {
      execFileSync("codesign", ["--force", "--sign", "-", "--timestamp=none", engine]);
      execFileSync("codesign", ["--force", "--sign", "-", "--timestamp=none", app]);
    };
    check({ root, app, engine, resource, sign });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test("linker-only code signatures are rejected without a complete bundle seal", native, () =>
  fixture(({ app }) => assert.throws(() => verifyMacosApp(app, expected))),
);
test("a complete App and its engine verify without altering sealed resources", native, () =>
  fixture(({ app, resource, sign }) => {
    sign();
    const before = readFileSync(resource);
    assert.equal(verifyMacosApp(app, expected).version, expected.version);
    assert.deepEqual(readFileSync(resource), before);
    assert.throws(
      () => verifyMacosApp(app, { ...expected, version: "0.3.0" }),
      /identity\/version/,
    );
  }),
);
test("modified bundle resources cannot pass the release check", native, () =>
  fixture(({ app, resource, sign }) => {
    sign();
    verifyMacosApp(app, expected);
    writeFileSync(resource, "altered resource");
    assert.throws(() => verifyMacosApp(app, expected), /verification failed/);
  }),
);
test("a missing or modified embedded engine cannot pass the release check", native, () =>
  fixture(({ app, engine, sign }) => {
    sign();
    writeFileSync(engine, "altered engine");
    assert.throws(() => verifyMacosApp(app, expected), /verification failed/);
    rmSync(engine);
    assert.throws(() => verifyMacosApp(app, expected));
  }),
);
test(
  "the read-only DMG check validates the actual distributed copy and detects substitution",
  native,
  () =>
    fixture(({ root, app, resource, sign }) => {
      sign();
      const reference = verifyMacosApp(app, expected);
      const dmg = join(root, "fixture.dmg");
      execFileSync("hdiutil", ["create", "-quiet", "-format", "UDZO", "-srcfolder", app, dmg]);
      assert.deepEqual(verifyMacosDmg(dmg, expected, reference), reference);
      writeFileSync(resource, "another correctly signed build");
      sign();
      assert.throws(
        () => verifyMacosDmg(dmg, expected, verifyMacosApp(app, expected)),
        /does not contain/,
      );
    }),
);
