# AGENTS.md

## Cursor Cloud specific instructions

This repository ("UsfmTools") contains TypeScript tools for processing USFM (Unified Standard Format Markers) scripture text.

### Project Layout

- `packages/usfm-parser/` — USFM parser library (TypeScript, bundled with tsup)
- `Plan/` — Obsidian-compatible planning documents

### Development Commands

All commands run from `packages/usfm-parser/`:

| Task        | Command                 |
|-------------|-------------------------|
| Install     | `npm install`           |
| Build       | `npm run build`         |
| Test        | `npm test`              |
| Lint        | `npm run lint`          |
| Type-check  | `npm run typecheck`     |

### Notes

- Node.js 20+ is required.
- The parser package outputs both ESM (`dist/index.js`) and CJS (`dist/index.cjs`) bundles.
- Tests use vitest; lint uses ESLint with typescript-eslint.
- The parser has zero runtime dependencies — all deps are devDependencies.
