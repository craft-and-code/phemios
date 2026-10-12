import path from "node:path";
import { readFile } from "node:fs/promises";
import { defineConfig, type Plugin } from "vite";
import {
  assertComponentExplorerImport,
  componentExplorerPublicAsset,
} from "../../scripts/component-explorer-policy.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const boundary: Plugin = {
  name: "phemios-component-boundary",
  enforce: "pre",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const file = componentExplorerPublicAsset(request.method, request.url, root);
      if (!file) return next();
      try {
        const bytes = await readFile(file);
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Content-Length", bytes.length);
        response.end(request.method === "HEAD" ? undefined : bytes);
      } catch {
        response.statusCode = 404;
        response.end();
      }
    });
  },
  resolveId(source, importer) {
    assertComponentExplorerImport(source, importer, root);
    return null;
  },
};
/** The Solid adapter adds its compiler; native dev settings and environment files are excluded. */
export default defineConfig({
  plugins: [boundary],
  publicDir: false,
  resolve: {
    alias: { "/demo/landscape.svg": path.join(root, "public/demo/landscape.svg") },
  },
  envDir: false,
  envPrefix: [],
  server: {
    host: "127.0.0.1",
    fs: {
      strict: true,
      allow: [root],
      deny: [
        ".env",
        ".env.*",
        "**/.git/**",
        "**/src-tauri/**",
        "**/core/**",
        "**/dist-native/**",
        "**/*.pem",
      ],
    },
  },
});
