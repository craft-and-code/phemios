import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  clearScreen: false,
  server: {
    strictPort: true,
    // Cargo/Tauri rebuilds must not trigger browser reloads through generated assets.
    watch: { ignored: ["**/target/**", "**/src-tauri/**", "**/dist-native/**"] },
  },
  build: { target: "es2022" },
});
