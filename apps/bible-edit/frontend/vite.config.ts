import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.join(rootDir, "../../..");

const nodeModules = path.join(rootDir, "node_modules");

function aliasNpmPackages(...names: string[]) {
  return Object.fromEntries(names.map((name) => [name, path.join(nodeModules, name)]));
}

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [rootDir, workspaceRoot, path.join(workspaceRoot, "packages")],
    },
  },
  resolve: {
    alias: {
      ...aliasNpmPackages(
        "@codemirror/autocomplete",
        "@codemirror/commands",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/search",
        "@codemirror/state",
        "@codemirror/view",
        "@lezer/highlight",
        "@lezer/lr",
        "crelt",
        "react",
        "react-dom",
        "react/jsx-runtime",
      ),
      "@usfm-tools/controls/styles.css": path.join(
        workspaceRoot,
        "packages/usfm-controls/src/styles.css",
      ),
      "@usfm-tools/controls": path.join(workspaceRoot, "packages/usfm-controls/src/index.ts"),
      "@usfm-tools/parser": path.join(workspaceRoot, "packages/usfm-parser/src/index.ts"),
      "@usfm-tools/model": path.join(workspaceRoot, "packages/usfm-model/src/index.ts"),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
});
