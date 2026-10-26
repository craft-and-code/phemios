import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkWebDemo } from "../scripts/check-web-demo.mjs";
import { installWebDemoFixture } from "./web-demo-publication-fixture.mjs";
test("publication refuses personal-mode builds, root-based assets and changed licensed recordings", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "phemios-publication-"));
  try {
    await installWebDemoFixture(root);
    await checkWebDemo(root);
    const file = path.join(root, "web-build.json"),
      good = await readFile(file, "utf8"),
      build = JSON.parse(good);
    for (const changed of [
      { ...build, profile: "personal" },
      { ...build, base: "/" },
      { ...build, sharedAudio: "b".repeat(40) },
    ]) {
      await writeFile(file, JSON.stringify(changed));
      await assert.rejects(checkWebDemo(root), /public-demo/);
    }
    await writeFile(file, good);
    await writeFile(path.join(root, "index.html"), '<script src="/assets/demo.js"></script>');
    await assert.rejects(checkWebDemo(root), /relative/);
    await writeFile(path.join(root, "index.html"), '<script src="./assets/demo.js"></script>');
    await writeFile(path.join(root, "web-demo/audio/fixture0.mp3"), "changed");
    await assert.rejects(checkWebDemo(root), /differs/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
