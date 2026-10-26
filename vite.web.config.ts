import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config.ts";
export default mergeConfig(
  base,
  defineConfig({
    publicDir: "web-public",
    define: { "import.meta.env.VITE_PHEMIOS_WEB": JSON.stringify("true") },
    // Session/audio singletons use the page lifecycle. Reload after source edits;
    // hot replacement could otherwise leave a retained controller bound to a retired bridge.
    server: { host: "127.0.0.1", port: 1440, strictPort: true, hmr: false },
    build: { outDir: "dist-web" },
  }),
);
