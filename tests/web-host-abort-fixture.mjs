// Executed in a child so an unhandled upstream stream error cannot take down the main suite.
import http from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWebServer } from "../scripts/serve-web.mjs";
const directory = mkdtempSync(join(tmpdir(), "phemios-web-abort-"));
writeFileSync(join(directory, "index.html"), "web");
const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)),
  );
const close = (server) => new Promise((resolve) => server.close(resolve));
const aede = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": "10000" });
  res.flushHeaders();
  res.write("partial");
  setImmediate(() => res.destroy());
});
let gateway;
try {
  const upstream = await listen(aede);
  gateway = createWebServer({ directory, aede: upstream });
  const base = await listen(gateway);
  await new Promise((resolve) => {
    const req = http.get(base + "/api/me/v1/exports/original", (res) => {
      res.on("error", resolve);
      res.on("aborted", resolve);
      res.on("end", resolve);
      res.resume();
    });
    req.on("error", resolve);
  });
  // The process must remain healthy and serve another request after the interrupted upstream.
  await new Promise((resolve, reject) => {
    http
      .get(base + "/", (res) => {
        res.resume();
        res.on("end", resolve);
        res.on("error", reject);
      })
      .on("error", reject);
  });
} finally {
  if (gateway) await close(gateway);
  await close(aede);
  rmSync(directory, { recursive: true });
}
