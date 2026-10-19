import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
/** Self-contained website component: no native bridge, app entry or environment injection. */
export default defineConfig({
  plugins: [solid()],
  envDir: false,
  envPrefix: [],
  publicDir: false,
  build: {
    outDir: "dist-analysis",
    target: "es2022",
    lib: {
      entry: "src/analysis-report/index.tsx",
      formats: ["es"],
      fileName: "flac-analysis-report",
      cssFileName: "flac-analysis-report",
    },
  },
});
