import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  assertComponentExplorerImport,
  componentExplorerArguments,
  componentExplorerPublicAsset,
} from "../scripts/component-explorer-policy.mjs";

const root = path.resolve("/fictional/phemios");
test("component development cannot bind externally or reuse the desktop port", () => {
  const args = componentExplorerArguments("dev", root);
  assert.equal(args[args.indexOf("--host") + 1], "127.0.0.1");
  assert.equal(args[args.indexOf("--port") + 1], "6006");
  assert(args.includes("--exact-port") && args.includes("--ci") && args.includes("--no-open"));
  assert(args.includes("--disable-telemetry") && args.includes("--no-version-updates"));
  assert.equal(
    args[args.indexOf("--config-dir") + 1],
    path.join(root, "docs/components/.storybook"),
  );
});
test("component publication is separated from native production output", () => {
  const args = componentExplorerArguments("build", root);
  assert.equal(args[args.indexOf("--output-dir") + 1], path.join(root, "dist-docs/components"));
  assert(args.includes("--disable-telemetry"));
  assert(!args.includes("--host") && !args.includes("--port"));
  for (const mode of ["preview", "--host", "dev --host 0.0.0.0", "", undefined])
    assert.throws(() => componentExplorerArguments(mode, root), /exactly|Use component/);
});
test("the component boundary admits real primitives and pure policies", () => {
  const importer = path.join(root, "docs/components/stories/Tags.stories.tsx");
  for (const source of ["../../../src/components/TagInput", "solid-js", "storybook/test"])
    assert.doesNotThrow(() => assertComponentExplorerImport(source, importer, root));
  assert.doesNotThrow(() =>
    assertComponentExplorerImport(
      "../library/tags",
      path.join(root, "src/components/TagInput.tsx"),
      root,
    ),
  );
});
test("the component boundary refuses transitive native imports and full application state", () => {
  const importer = path.join(root, "src/components/Unsafe.tsx");
  for (const source of [
    "@tauri-apps/api/core",
    "tauri://localhost",
    "../platform/desktop",
    "../library/context.tsx?raw",
    "../main",
    "../App.tsx",
    path.join(root, "src/platform/desktop.ts"),
  ])
    assert.throws(() => assertComponentExplorerImport(source, importer, root), /cannot import/);
});

test("the development explorer serves only its exact public boundary file", () => {
  for (const method of ["GET", "HEAD"])
    assert.equal(
      componentExplorerPublicAsset(method, "/geography/countries.json?v=1", root),
      path.join(root, "public/geography/countries.json"),
    );
  for (const url of [
    undefined,
    "/geography/../private.json",
    "/geography/%2e%2e/private.json",
    "/geography/countries.json/extra",
    "/.env",
    "/geography/",
  ])
    assert.equal(componentExplorerPublicAsset("GET", url, root), undefined);
  for (const method of [undefined, "POST", "PUT", "DELETE"])
    assert.equal(
      componentExplorerPublicAsset(method, "/geography/countries.json", root),
      undefined,
    );
});
