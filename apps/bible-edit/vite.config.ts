import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { defineConfig } from "vite";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.join(appDir, "web");
const repoRoot = path.join(appDir, "../..");

export default defineConfig({
  root: webDir,
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@usfm-tools/parser": path.join(repoRoot, "packages/usfm-parser/src/index.ts"),
      "@usfm-tools/model": path.join(repoRoot, "packages/usfm-model/src/index.ts"),
      "@usfm-tools/controls": path.join(repoRoot, "packages/usfm-controls/src/index.ts"),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss({ config: path.join(appDir, "tailwind.config.js") }), autoprefixer()],
    },
  },
});
