import { test } from "node:test";
import assert from "node:assert/strict";
import { lockedCredits, dependencyCredits } from "../scripts/dependency-credits.mjs";
test("locked credits retain exact simultaneous versions and exclude workspace/npm development entries", () => {
  const rows = lockedCredits(
    {
      packages: {
        "": { version: "1" },
        "node_modules/a": { version: "2.1.0" },
        "node_modules/b/node_modules/a": { version: "2.1.0" },
        "node_modules/dev": { version: "3", dev: true },
      },
    },
    '[[package]]\nname = "local"\nversion = "1"\n[[package]]\nname = "serde"\nversion = "1.0.1"\nsource = "registry+x"\n[[package]]\nname = "serde"\nversion = "1.0.2"\nsource = "registry+x"\n',
  );
  assert.deepEqual(
    rows.map((r) => `${r.name}@${r.version}`),
    ["serde@1.0.1", "serde@1.0.2", "a@2.1.0"],
  );
  assert.ok(rows.every((r) => r.url.startsWith("https://")));
});
test("the application inventories its real lockfiles without launching an engine", () => {
  const rows = dependencyCredits();
  assert.ok(rows.some((r) => r.name === "solid-js" && r.version === "1.9.17"));
  assert.ok(rows.some((r) => r.name === "rustls"));
});

test("the reviewed local GLib source remains in third-party credits", () => {
  const rows = dependencyCredits();
  assert.equal(rows.filter((r) => r.name === "glib" && r.version === "0.18.5").length, 1);
});

test("both reviewed local macro packages retain third-party credits", () => {
  const rows = dependencyCredits();
  for (const [name, version] of [
    ["glib-macros", "0.18.5"],
    ["gtk3-macros", "0.18.2"],
  ]) {
    assert.equal(rows.filter((row) => row.name === name && row.version === version).length, 1);
  }
});
