import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { assertComponentExplorerImport } from "../../scripts/component-explorer-policy.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const boundary: Plugin = {
  name: "phemios-component-boundary",
  enforce: "pre",
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
