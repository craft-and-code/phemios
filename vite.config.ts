import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { dependencyCredits } from "./scripts/dependency-credits.mjs";
import { devServerOptions } from "./scripts/development.mjs";

export default defineConfig({
  plugins: [solid()],
  define: { __PHEMIOS_DEPENDENCIES__: JSON.stringify(dependencyCredits()) },
  clearScreen: false,
  server: {
    ...devServerOptions(),
    // Cargo/Tauri rebuilds must not trigger browser reloads through generated assets.
    watch: { ignored: ["**/target/**", "**/src-tauri/**", "**/dist-native/**"] },
  },
  build: { target: "es2022" },
});
