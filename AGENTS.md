# AGENTS.md

## Cursor Cloud specific instructions

This repository ("UsfmTools") contains TypeScript tools for processing USFM (Unified Standard Format Markers) scripture text.

### Project Layout

- `packages/usfm-parser/` — USFM parser library (TypeScript, bundled with tsup)
- `bible-edit/` — Tauri desktop application (React + Vite + Tailwind) at the repository root; end-product app, not a consumable package under `packages/`
- `Plan/` — Obsidian-compatible planning documents

### Development Commands

**Parser** — run from `packages/usfm-parser/`:

| Task        | Command                 |
|-------------|-------------------------|
| Install     | `npm install`           |
| Build       | `npm run build`         |
| Test        | `npm test`              |
| Lint        | `npm run lint`          |
| Type-check  | `npm run typecheck`     |

**bible-edit** — run from `bible-edit/` (repository root):

| Task        | Command                 |
|-------------|-------------------------|
| Install     | `npm install`           |
| Frontend build | `npm run build`      |
| Test        | `npm test`              |
| Desktop dev | `npm run tauri dev`     |

### Notes

- Node.js 20+ is required.
- The parser package outputs both ESM (`dist/index.js`) and CJS (`dist/index.cjs`) bundles.
- Parser tests use vitest; lint uses ESLint with typescript-eslint.
- The parser has zero runtime dependencies — all deps are devDependencies.
- `bible-edit` additionally needs Rust (**see `bible-edit/rust-toolchain.toml`**, currently **1.88+** for Tauri 2’s dependency graph) and [Tauri prerequisites](https://tauri.app/start/prerequisites/) for `npm run tauri dev` / `tauri build`. On Linux, install GTK/WebKit dev packages listed in `bible-edit/README.md` so `pkg-config` finds `gdk-3.0` and `webkit2gtk-4.1`.
