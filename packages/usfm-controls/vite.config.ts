import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.join(rootDir, "../..");

export default defineConfig({
  server: {
    fs: {
      allow: [
        rootDir,
        workspaceRoot,
        path.join(workspaceRoot, "node_modules"),
        path.join(workspaceRoot, "packages"),
      ],
    },
  },
  resolve: {
    alias: {
      "@usfm-tools/parser": path.join(rootDir, "../usfm-parser/src/index.ts"),
      "@usfm-tools/model": path.join(rootDir, "../usfm-model/src/index.ts"),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
});
