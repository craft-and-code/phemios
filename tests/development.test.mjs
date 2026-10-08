import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:net";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { devServerOptions, developmentArguments, startFrontend } from "../scripts/development.mjs";

test("an explicit development port is validated and stays strict", () => {
  assert.deepEqual(devServerOptions({}), { host: "127.0.0.1", port: 1420, strictPort: false });
  assert.equal(devServerOptions({ PHEMIOS_DEV_PORT: "1500" }).port, 1500);
  assert.equal(devServerOptions({ PHEMIOS_DEV_PORT: "1500" }).strictPort, true);
  for (const raw of ["", "0", "65536", "abc", "1420x", "1.5"])
    assert.throws(() => devServerOptions({ PHEMIOS_DEV_PORT: raw }), /PHEMIOS_DEV_PORT/);
});

test("Tauri uses Vite's actual port without starting a second server or changing runner arguments", () => {
  const args = developmentArguments(["dev", "--no-watch", "--", "--release", "--", "test"], 1500);
  const at = args.indexOf("--config");
  assert.deepEqual(JSON.parse(args[at + 1]), {
    build: { devUrl: "http://127.0.0.1:1500", beforeDevCommand: "" },
  });
  assert.deepEqual(args.slice(at + 2), ["--", "--release", "--", "test"]);
  assert(args.includes("--no-watch"));
});

test("an occupied default port moves Vite and Tauri together; a pinned port fails explicitly", async () => {
  const blocker = createServer();
  await new Promise((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, "127.0.0.1", resolve);
  });
  const port = blocker.address().port;
  const root = await mkdtemp(join(tmpdir(), "phemios-dev-test-"));
  await writeFile(join(root, "index.html"), "<!doctype html><title>Local fixture</title>");
  let frontend;
  try {
    const config = {
      root,
      configFile: false,
      logLevel: "silent",
      server: { ...devServerOptions({}), port },
    };
    await assert.rejects(
      startFrontend({ ...config, server: { ...config.server, strictPort: true } }),
      /already in use/,
    );
    frontend = await startFrontend(config);
    assert.notEqual(frontend.port, port);
    const args = developmentArguments(["dev"], frontend.port);
    const url = JSON.parse(args[args.indexOf("--config") + 1]).build.devUrl;
    assert.match(await (await fetch(url)).text(), /<title>Local fixture<\/title>/);
  } finally {
    await frontend?.server.close();
    await new Promise((resolve) => blocker.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
