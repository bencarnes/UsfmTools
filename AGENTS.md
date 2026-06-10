# AGENTS.md

## Cursor Cloud specific instructions

This repository ("UsfmTools") contains TypeScript tools for processing USFM (Unified Standard Format Markers) scripture text.

### Project Layout

- `packages/usfm-parser/` — USFM parser library (TypeScript, Deno workspace member)
- `packages/usfm-model/` — application-level model on top of the parser
- `packages/usfm-controls/` — React + CodeMirror UI controls
- `packages/usfm-parser-integration-tests/` — integration tests against the Berean Standard Bible corpus
- `Plan/` — Obsidian-compatible planning documents

All packages under `packages/` are **Deno projects** wired together as a [Deno workspace](https://docs.deno.com/runtime/fundamentals/configuration/#workspaces) (root `deno.json`).

### Requirements

- **Deno 2+** ([install](https://docs.deno.com/runtime/getting_started/installation/))

### Development Commands

Run from the **repository root** for the whole workspace, or from an individual package directory.

| Task | Command (root) | Command (single package) |
|------|----------------|--------------------------|
| Type-check | `deno task check` | `deno task check` |
| Test | `deno task test` | `deno task test` |
| Lint | `deno task lint` | `deno task lint` |
| Check + test all | `./build.sh` | — |

Package dependency order: **usfm-parser** → **usfm-model** → **usfm-controls**. Integration tests depend on **usfm-parser**.

### Notes

- Packages export TypeScript source via `deno.json` `exports` (no npm `dist/` bundles).
- Local workspace imports use package names such as `@usfm-tools/parser`.
- TypeScript sources use `.js` extensions in relative imports; the workspace enables `unstable-sloppy-imports` so Deno resolves them to `.ts` files.
- **usfm-controls** React tests use happy-dom (`tests/dom-setup.ts`, `tests/testing-react.ts`). CodeMirror-heavy suites pass `flushTimers: true` to `registerDomTestHooks()` so pending timers finish before unmount.
- Storybook was removed during the Deno migration; component behavior is covered by the Deno test suite.
