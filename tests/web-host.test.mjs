import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { createWebServer, upstreamAddress } from "../scripts/serve-web.mjs";
const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)),
  );
const close = (server) => new Promise((resolve) => server.close(resolve));
const request = (url, options = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      const chunks = [];
      res.on("data", (b) => chunks.push(b));
      res.on("end", () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        }),
      );
    });
    req.on("error", reject);
    req.end();
  });
test("web host serves real ranges and WASM while rejecting foreign origins, hosts and escaped symlinks", async () => {
  const directory = mkdtempSync(join(tmpdir(), "phemios-web-host-")),
    outside = mkdtempSync(join(tmpdir(), "phemios-web-outside-"));
  writeFileSync(join(directory, "index.html"), "web");
  writeFileSync(join(directory, "audio.mp3"), "0123456789");
  writeFileSync(join(directory, "audio.m4a"), "aac");
  writeFileSync(join(directory, "dsp.wasm"), "wasm");
  writeFileSync(join(outside, "private.txt"), "private");
  symlinkSync(join(outside, "private.txt"), join(directory, "escaped.txt"));
  const server = createWebServer({ directory });
  try {
    const base = await listen(server);
    const range = await request(base + "/audio.mp3", { headers: { range: "bytes=2-5" } });
    assert.equal(range.status, 206);
    assert.equal(range.body, "2345");
    assert.equal((await request(base + "/audio.m4a")).headers["content-type"], "audio/mp4");
    assert.equal((await request(base + "/dsp.wasm")).headers["content-type"], "application/wasm");
    assert.equal(
      (await request(base + "/audio.mp3", { headers: { range: "bytes=99-100" } })).status,
      416,
    );
    assert.equal((await request(base + "/", { headers: { host: "evil.invalid" } })).status, 403);
    assert.equal(
      (await request(base + "/", { headers: { origin: "https://evil.invalid" } })).status,
      403,
    );
    assert.equal((await request(base + "/escaped.txt")).status, 404);
    assert.equal((await request(base + "/api/v1/status")).status, 503);
  } finally {
    await close(server);
    rmSync(directory, { recursive: true });
    rmSync(outside, { recursive: true });
  }
});
test("gateway only contacts its configured Aède and never follows an absolute request target", async () => {
  const directory = mkdtempSync(join(tmpdir(), "phemios-web-proxy-"));
  writeFileSync(join(directory, "index.html"), "web");
  let calls = 0,
    credential;
  const aede = http.createServer((req, res) => {
    calls++;
    credential = req.headers.authorization;
    res.setHeader("Content-Type", "application/json");
    res.end('{"status":"ok"}');
  });
  let gateway;
  try {
    const upstream = await listen(aede);
    gateway = createWebServer({ directory, aede: upstream });
    const base = await listen(gateway);
    const response = await request(base + "/api/v1/status", {
      headers: { authorization: "Bearer fixture", origin: base },
    });
    assert.equal(response.status, 200);
    assert.equal(credential, "Bearer fixture");
    assert.equal((await request(base, { path: upstream + "/api/v1/status" })).status, 400);
    assert.equal(calls, 1);
  } finally {
    if (gateway) await close(gateway);
    await close(aede);
    rmSync(directory, { recursive: true });
  }
});
test("gateway configuration requires a clean HTTPS authority or explicit loopback", () => {
  assert.equal(upstreamAddress("http://127.0.0.1:8787").origin, "http://127.0.0.1:8787");
  for (const address of [
    "http://remote.example",
    "https://user:password@example.test",
    "https://example.test/path",
    "file:///tmp/data",
  ])
    assert.throws(() => upstreamAddress(address));
});

test("an upstream disconnect does not crash the gateway or strand later static requests", async () => {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(
    process.execPath,
    [new URL("./web-host-abort-fixture.mjs", import.meta.url).pathname],
    { encoding: "utf8", timeout: 10000 },
  );
  assert.equal(result.status, 0, result.stderr);
});
