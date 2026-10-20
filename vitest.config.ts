import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  resolve: { alias: [{ find: /^solid-js$/, replacement: "solid-js/dist/solid.js" }] },
  test: { environment: "node", include: ["src/**/*.test.ts"], passWithNoTests: true },
});
