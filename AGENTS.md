# AGENTS.md

## Cursor Cloud specific instructions

This repository ("UsfmTools") contains tools for processing USFM (Unified Standard Format Markers) scripture text: TypeScript UI libraries, a Go parser/engine module, and a Wails desktop app.

### Project Layout

- `usfm-parser-go/` — **Go module** (`github.com/usfm-tools/usfm-parser-go`): USFM parser, diagnostics, preview renderer, LSP-like async engine, and the `usfm` CLI (`cmd/usfm`). See its README for architecture and protocol.
- `packages/usfm-controls/` — React + CodeMirror UI controls and the `UsfmLanguageClient` protocol (Deno workspace member)
- `packages/usfm-model/` — parser-free helpers (book identifiers, file-picker grouping, chapter/book-code text scans)
- `apps/bible-edit/` — **BibleEdit** desktop editor (Wails): Go backend binding the engine + npm/vite React frontend
- `bibles/bsb/usfm/` — Berean Standard Bible corpus (66 books) used by tests
- `Plan/` — Obsidian-compatible planning documents; `todo.md` — in-flight work tracker

All packages under `packages/` are **Deno projects** wired together as a [Deno workspace](https://docs.deno.com/runtime/fundamentals/configuration/#workspaces) (root `deno.json`).

### Requirements

- **Deno 2+** ([install](https://docs.deno.com/runtime/getting_started/installation/))
- **Go 1.22+** ([install](https://go.dev/dl/)) — needed by `deno task build` for `usfm-parser-go`
- Desktop app builds additionally need the **Wails CLI v2**, **npm**, and (Linux) **WebKitGTK 4.0/4.1**

### Development Commands

| Task | Command | Where |
|------|---------|-------|
| Check + test everything | `deno task build` (runs `build.ts`; `./build.sh` wraps it) | repo root |
| Type-check TS | `deno task check` | repo root or a `packages/*` dir |
| Test TS | `deno task test` | repo root or a `packages/*` dir |
| Lint TS | `deno task lint` | repo root or a `packages/*` dir |
| Vet/test Go | `go vet ./...` / `go test ./...` | `usfm-parser-go/` (also `apps/bible-edit/`) |
| Engine race suite | `go test -race ./engine/` | `usfm-parser-go/` |
| Build the CLI | `go build ./cmd/usfm` | `usfm-parser-go/` |
| Build the desktop app | `deno task build:bible-edit` (runs `apps/bible-edit/build.ts`; `apps/bible-edit/build.sh` wraps it) | repo root (auto-adds `-tags webkit2_41` when WebKitGTK 4.0 is absent) |
| Run the app in dev mode | `wails dev -tags webkit2_41` | `apps/bible-edit/` (tag required on distros without WebKitGTK 4.0, e.g. Debian 13+; plain `wails dev` fails with "webkit2gtk-4.0 not found") |
| Regenerate Wails JS bindings | `wails generate module` | `apps/bible-edit/` (after changing bound Go types/methods) |
| Component stories (Ladle) | `deno task ladle` | `packages/usfm-controls/` |

Root `deno task check`/`test` (and `deno task build`) cover **usfm-model** and **usfm-controls**. There is no TypeScript USFM parser: parsing and analysis live only in the Go module. Dependency order: **usfm-model** → **usfm-controls**; the Go module is independent; **bible-edit** depends on the Go module (via a `replace` directive in its `go.mod`) and on `usfm-controls` source (via vite aliases).

### Notes

- Packages export TypeScript source via `deno.json` `exports` (no npm `dist/` bundles).
- Local workspace imports use package names such as `@usfm-tools/controls`.
- TypeScript sources use `.js` extensions in relative imports; the workspace enables `unstable-sloppy-imports` so Deno resolves them to `.ts` files.
- Language features (diagnostics, highlighting, completions, preview) flow through the `UsfmLanguageClient` protocol (`usfm-controls/src/language-service/protocol.ts`). In BibleEdit it is backed by the Go engine over Wails bindings (`apps/bible-edit/frontend/src/language-client.ts`); without an injected client, components fall back to an inert stub (`createStubLanguageClient`, `language-service/stub-client.ts`): it tracks documents but returns no diagnostics, tokens or completions, derives structure from the `@usfm-tools/model` text scans, and previews the escaped source. Stories use the stub; tests that assert on highlighting or diagnostics inject the regex-based fake in `usfm-controls/tests/fake-language-client.ts`.
- Editor views showing the same file share one client document via `createDocumentSessionManager` (`usfm-controls/src/language-service/document-sessions.ts`), keyed by file id: edits forward to the client once and to sibling views synchronously (annotated CodeMirror transactions, excluded from the sibling's undo history); the `UsfmShell` owns the manager. Editors without a manager get a private document.
- The **bible-edit frontend** is npm/vite (not Deno); `frontend/vite.config.ts` aliases `@usfm-tools/controls` to the package source, and `frontend/src/usfm-controls.d.ts` is a hand-maintained type shim for those imports — keep it in sync when the controls API changes. Generated bindings live in `frontend/wailsjs/` (do not edit by hand).
- **usfm-controls** React tests use happy-dom (`tests/dom-setup.ts`, `tests/testing-react.ts`). CodeMirror-heavy suites pass `flushTimers: true` to `registerDomTestHooks()` so pending timers finish before unmount.
- **usfm-controls** component stories use [Ladle](https://ladle.dev/) via Deno (`deno task ladle` / `deno task ladle:build` in `packages/usfm-controls/`). Ladle runs through Vite with `--node-modules-dir=auto` (see that package’s `deno.json` tasks). `vite.config.ts` uses `@vitejs/plugin-react` (Babel) instead of Ladle’s default SWC plugin so no Node.js/npm CLI is required for postinstall scripts. Config lives in `.ladle/` and `vite.config.ts`. Ladle may create a gitignored `node_modules/` at the repo root; `deno task build` removes it so tests resolve npm packages from Deno’s cache without requiring the npm CLI.
