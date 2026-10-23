import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
test("neither macro owner can reintroduce the abandoned macro-error branch", () => {
  const lock = readFileSync(new URL("Cargo.lock", root), "utf8");
  for (const name of ["proc-macro-error", "proc-macro-error-attr"]) {
    assert.ok(!lock.includes(`name = "${name}"`));
  }
  for (const name of ["glib-macros", "gtk3-macros"]) {
    const manifest = readFileSync(new URL(`vendor/${name}/Cargo.toml`, root), "utf8");
    assert.ok(!manifest.includes("[dependencies.proc-macro-error]"));
    const block = lock.split("[[package]]").find((part) => part.includes(`name = "${name}"`));
    assert.ok(block);
    assert.ok(!block.includes("source ="));
  }
});
