import http from "node:http";
import https from "node:https";
import { createReadStream, statSync, realpathSync } from "node:fs";
import { resolve, sep, extname } from "node:path";
import { pathToFileURL } from "node:url";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
export function upstreamAddress(value) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !["http:", "https:"].includes(url.protocol) ||
    (url.protocol === "http:" && !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
  )
    throw new Error(
      "Aède needs HTTPS, or an explicit loopback HTTP address, without credentials or a path.",
    );
  return url;
}
/** Optional loopback-only static host/gateway. It never stores sessions or starts/scans an Aède engine. */
export function createWebServer({ directory, aede } = {}) {
  const root = realpathSync(directory ?? resolve(import.meta.dirname, "../dist-web"));
  const target = aede ? upstreamAddress(aede) : undefined;
  return http.createServer((request, response) => {
    const address = request.socket.localPort,
      authority = `127.0.0.1:${address}`;
    if (
      ![authority, `localhost:${address}`].includes(request.headers.host) ||
      (request.headers.origin &&
        ![`http://${authority}`, `http://localhost:${address}`].includes(request.headers.origin))
    ) {
      response.writeHead(403).end();
      return;
    }
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    if (!request.url?.startsWith("/") || request.url.startsWith("//")) {
      response.writeHead(400).end();
      return;
    }
    request.setTimeout(15000, () => request.destroy());
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, `http://${authority}`).pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (pathname.startsWith("/api/")) {
      if (!target) {
        response
          .writeHead(503, { "Content-Type": "application/json" })
          .end(
            JSON.stringify({ error: "Start this host with --aede to connect a personal library." }),
          );
        return;
      }
      if (
        !["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(request.method) ||
        /[\\\0]/.test(pathname) ||
        pathname.includes("..")
      ) {
        response.writeHead(400).end();
        return;
      }
      const chunks = [];
      let size = 0;
      request.on("data", (chunk) => {
        size += chunk.length;
        if (size > 65536) request.destroy();
        else chunks.push(chunk);
      });
      request.on("end", () => {
        const headers = { host: target.host };
        for (const key of ["authorization", "content-type", "range"])
          if (typeof request.headers[key] === "string") headers[key] = request.headers[key];
        if (request.headers.origin) headers.origin = target.origin;
        const upstream = (target.protocol === "https:" ? https : http).request(
          new URL(request.url, target),
          { method: request.method, headers, timeout: 65000 },
          (incoming) => {
            response.statusCode = incoming.statusCode ?? 502;
            for (const key of ["content-type", "content-length", "content-range", "accept-ranges"])
              if (incoming.headers[key]) response.setHeader(key, incoming.headers[key]);
            response.setHeader("Cache-Control", "no-store");
            let received = 0;
            // pipe() does not propagate source errors to its destination. Retire a
            // truncated upstream explicitly so the browser and later requests can finish.
            incoming.on("error", () => response.destroy());
            incoming.on("aborted", () => response.destroy());
            incoming.on("data", (chunk) => {
              received += chunk.length;
              if (received > 64 * 1024 * 1024) {
                upstream.destroy();
                response.destroy();
              }
            });
            incoming.pipe(response);
          },
        );
        const failed = () => {
          if (!response.headersSent) response.writeHead(502);
          response.end();
        };
        upstream.on("timeout", () => upstream.destroy());
        upstream.on("error", failed);
        response.on("close", () => upstream.destroy());
        upstream.end(Buffer.concat(chunks));
      });
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405).end();
      return;
    }
    try {
      let file = resolve(root, "." + pathname);
      if (pathname.endsWith("/")) file = resolve(file, "index.html");
      if (!extname(file)) file = resolve(root, "index.html");
      file = realpathSync(file);
      if (!file.startsWith(root + sep) || !statSync(file).isFile()) {
        response.writeHead(404).end();
        return;
      }
      const size = statSync(file).size;
      let start = 0,
        end = size - 1;
      if (request.headers.range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
        start = Number(match?.[1]);
        end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
        if (
          !match ||
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start < 0 ||
          end < start ||
          start >= size
        ) {
          response.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
          return;
        }
        response.statusCode = 206;
        response.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      }
      response.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
      response.setHeader("Accept-Ranges", "bytes");
      response.setHeader("Content-Length", Math.max(0, end - start + 1));
      if (request.method === "HEAD" || size === 0) response.end();
      else {
        const stream = createReadStream(file, { start, end });
        stream.on("error", () => response.destroy());
        response.on("close", () => stream.destroy());
        stream.pipe(response);
      }
    } catch {
      response.writeHead(404).end();
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  let aede,
    port = 1441;
  while (args.length) {
    const key = args.shift(),
      value = args.shift();
    if (key === "--aede" && value) aede = value;
    else if (key === "--port" && /^[1-9]\d*$/.test(value ?? "") && Number(value) <= 65535)
      port = Number(value);
    else throw new Error("Usage: node scripts/serve-web.mjs [--aede URL] [--port PORT]");
  }
  const server = createWebServer({ aede });
  server.listen(port, "127.0.0.1", () => console.log(`Phémios Web: http://127.0.0.1:${port}`));
}
