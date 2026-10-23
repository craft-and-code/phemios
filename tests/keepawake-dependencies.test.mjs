import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root = new URL("../", import.meta.url);

test("the Linux inhibition branch actually removes the retired standalone D-Bus crates", () => {
  const lock = readFileSync(new URL("Cargo.lock", root), "utf8");
  for (const name of ["zvariant", "zvariant_derive", "zbus_names"]) {
    assert.ok(!lock.includes(`name = "${name}"`));
  }
  const block = lock.split("[[package]]").find((part) => part.includes('name = "zbus"'));
  assert.ok(block?.includes('version = "6.1.0"'));
  assert.ok(
    lock.split("[[package]]").filter((part) => part.includes('name = "zbus"')).length === 1,
  );
});
