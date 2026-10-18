import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareVersions,
  publishedRelease,
  requireEngineVersions,
} from "../scripts/engine-policy.mjs";
test("release comparison handles numeric components and refuses ambiguous versions", () => {
  assert.equal(compareVersions("0.10.0", "0.9.6"), 1);
  assert.equal(compareVersions("0.5.0", "0.5.0"), 0);
  for (const value of ["v0.5.0", "00.5.0", "0.5.0-rc.1", "../../engine", null])
    assert.throws(() => compareVersions(value, "0.5.0"));
});
test("only published stable tags can select engine source", () => {
  const stable = {
    draft: false,
    prerelease: false,
    published_at: "2026-10-01T10:00:00Z",
    tag_name: "v0.5.0",
  };
  assert.deepEqual(publishedRelease(stable), { tag: "v0.5.0", version: "0.5.0" });
  for (const patch of [
    { draft: true },
    { prerelease: true },
    { published_at: null },
    { tag_name: "untagged-temporary" },
    { tag_name: "v0.5.0 --upload" },
  ])
    assert.throws(() => publishedRelease({ ...stable, ...patch }));
});
test("the client refuses server/core versions below its compatible minimum", () => {
  const required = { aede: "0.5.0", flaccompagnon: "0.9.6" };
  assert.doesNotThrow(() => requireEngineVersions(required, required));
  assert.throws(() => requireEngineVersions({ ...required, aede: "0.4.0" }, required));
  assert.throws(() => requireEngineVersions({ ...required, flaccompagnon: "0.9.5" }, required));
});
