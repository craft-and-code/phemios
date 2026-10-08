import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

// An undefined custom property silently drops a WebView paint declaration.
test("stylesheet variables resolve to theme or component declarations", async () => {
  const root = new URL("../src/", import.meta.url);
  const names = (await readdir(root, { recursive: true })).filter((name) =>
    /\.(css|tsx)$/.test(name),
  );
  const sources = await Promise.all(names.map((name) => readFile(new URL(name, root), "utf8")));
  const declared = new Set(
    sources.flatMap((source) => [...source.matchAll(/(--[\w-]+)["']?\s*:/g)].map((m) => m[1])),
  );
  const unresolved = new Set(
    sources.flatMap((source) =>
      [...source.matchAll(/var\(\s*(--[\w-]+)/g)]
        .map((m) => m[1])
        .filter((name) => !declared.has(name)),
    ),
  );
  assert.deepEqual([...unresolved], [], "UI colours must not fall back to invisible SVG defaults");
});
