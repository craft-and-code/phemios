import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const json = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
test("demo recordings, credits, real file properties and distinct artwork stay complete and Web-only", () => {
  const music = json("src/web/music.json"),
    credits = json("web-public/web-demo/credits.json"),
    properties = json("src/web/properties.json");
  assert.ok(music.length >= 10);
  assert.equal(new Set(music.map((row) => row.id)).size, music.length);
  assert.equal(new Set(music.map((row) => row.album)).size, music.length);
  assert.deepEqual([...new Set(credits.map((row) => row.artist))].sort(), [
    "Chris Zabriskie",
    "Scott Buckley",
  ]);
  assert.equal(credits.length, music.length);
  for (const recording of music) {
    const credit = credits.find((row) => row.file === `audio/${recording.file}`);
    assert.equal(credit?.title, recording.title);
    assert.equal(credit.licence, "CC BY 4.0");
    assert.equal(credit.licence_url, "https://creativecommons.org/licenses/by/4.0/");
    assert.equal(credit.modified, false);
    assert.ok(credit.source.startsWith("https://"));
    const file = new URL(`web-public/web-demo/${credit.file}`, root);
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), credit.sha256);
    assert.equal(statSync(file).size, properties[recording.id].size);
    assert.ok(recording.duration > 0);
    assert.ok(
      readFileSync(new URL(`web-public/web-demo/${recording.id}.svg`, root), "utf8").includes(
        "DEMO ARTWORK",
      ),
    );
    assert.equal(existsSync(new URL(`public/web-demo/${credit.file}`, root)), false);
  }
});
