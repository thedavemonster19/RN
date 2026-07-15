import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  base: "./",
  // Inline all JS/CSS into a single index.html so the whole game is one
  // uploadable file (great for GitHub Pages / sharing / Capacitor).
  plugins: [viteSingleFile()],
  server: {
    host: true,
    // Use the port the harness assigns (PORT), falling back to Vite's default.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    // Phaser scenes can't hot-swap, so HMR would reset a live game to the menu.
    // Disable it: edits require a manual reload, but play sessions stay stable.
    hmr: false,
  },
  build: {
    target: "es2020",
    // Capacitor serves the built assets from a file:// context, so keep paths relative.
    assetsDir: "assets",
  },
});
