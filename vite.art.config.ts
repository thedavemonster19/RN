import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    target: "es2020",
    outDir: "/private/tmp/claude-501/-Users-davengai-Desktop-Working-RN/34a159f2-fb86-47eb-b351-c0bd7a53ddf1/scratchpad/artout",
    emptyOutDir: true,
    rollupOptions: { input: "art-sheet.html" },
  },
});
