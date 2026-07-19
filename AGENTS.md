# AGENTS.md

## Cursor Cloud specific instructions

This repository ("UsfmTools") contains tools for processing USFM (Unified Standard Format Markers) scripture text: TypeScript UI libraries, a Go parser/engine module, and a Wails desktop app.

### Project Layout

- `usfm-parser-go/` — **Go module** (`github.com/usfm-tools/usfm-parser-go`): USFM parser, diagnostics, preview renderer, LSP-like async engine, and the `usfm` CLI (`cmd/usfm`). See its README for architecture and protocol.
- `packages/usfm-controls/` — React + CodeMirror UI controls and the `UsfmLanguageClient` protocol (Deno workspace member)
- `packages/usfm-model/` — view models / helpers on top of the parser (preview fallback, pickers, chapter scans)
- `packages/usfm-parser/` — ⚠️ **reference only**: the original TypeScript parser, superseded by `usfm-parser-go` and excluded from build/check/test. Do not add functionality here.
- `packages/usfm-parser-integration-tests/` — ⚠️ reference only (ported to `usfm-parser-go/integration/`)
- `apps/bible-edit/` — **BibleEdit** desktop editor (Wails): Go backend binding the engine + npm/vite React frontend
- `bibles/bsb/usfm/` — Berean Standard Bible corpus (66 books) used by tests and differential verification
- `Plan/` — Obsidian-compatible planning documents; `todo.md` — in-flight work tracker

All packages under `packages/` are **Deno projects** wired together as a [Deno workspace](https://docs.deno.com/runtime/fundamentals/configuration/#workspaces) (root `deno.json`).

### Requirements

- **Deno 2+** ([install](https://docs.deno.com/runtime/getting_started/installation/))
- **Go 1.22+** ([install](https://go.dev/dl/)) — needed by `./build.sh` for `usfm-parser-go`
- Desktop app builds additionally need the **Wails CLI v2**, **npm**, and (Linux) **WebKitGTK 4.0/4.1**

### Development Commands

| Task | Command | Where |
|------|---------|-------|
| Check + test everything | `./build.sh` | repo root |
| Type-check TS | `deno task check` | repo root or a `packages/*` dir |
| Test TS | `deno task test` | repo root or a `packages/*` dir |
| Lint TS | `deno task lint` | repo root or a `packages/*` dir |
| Vet/test Go | `go vet ./...` / `go test ./...` | `usfm-parser-go/` (also `apps/bible-edit/`) |
| Engine race suite | `go test -race ./engine/` | `usfm-parser-go/` |
| Build the CLI | `go build ./cmd/usfm` | `usfm-parser-go/` |
| Build the desktop app | `./build.sh` | `apps/bible-edit/` (auto-adds `-tags webkit2_41` when WebKitGTK 4.0 is absent) |
| Run the app in dev mode | `wails dev -tags webkit2_41` | `apps/bible-edit/` (tag required on distros without WebKitGTK 4.0, e.g. Debian 13+; plain `wails dev` fails with "webkit2gtk-4.0 not found") |
| Regenerate Wails JS bindings | `wails generate module` | `apps/bible-edit/` (after changing bound Go types/methods) |
| Component stories (Ladle) | `deno task ladle` | `packages/usfm-controls/` |

Root `deno task check`/`test` (and `./build.sh`) cover **usfm-model** and **usfm-controls** only; `usfm-parser` and its integration tests are reference-only and deliberately excluded. Dependency order: **usfm-model** → **usfm-controls**; the Go module is independent; **bible-edit** depends on the Go module (via a `replace` directive in its `go.mod`) and on `usfm-controls` source (via vite aliases).

### Notes

- Packages export TypeScript source via `deno.json` `exports` (no npm `dist/` bundles).
- Local workspace imports use package names such as `@usfm-tools/controls`.
- TypeScript sources use `.js` extensions in relative imports; the workspace enables `unstable-sloppy-imports` so Deno resolves them to `.ts` files.
- Language features (diagnostics, highlighting, completions, preview) flow through the `UsfmLanguageClient` protocol (`usfm-controls/src/language-service/protocol.ts`). In BibleEdit it is backed by the Go engine over Wails bindings (`apps/bible-edit/frontend/src/language-client.ts`); without an injected client, components fall back to the in-process TS implementation (`createLocalLanguageClient`), which is what stories and tests use.
- The Go parser/classifier/preview are kept **byte-identical** to the TS reference implementation, verified across the BSB corpus with the differential tools in `usfm-parser-go/internal/{lex,ast,class,preview}dump`. If you intentionally change behavior on one side, change the other (or record the divergence in `todo.md` follow-ups).
- The **bible-edit frontend** is npm/vite (not Deno); `frontend/vite.config.ts` aliases `@usfm-tools/controls` to the package source, and `frontend/src/usfm-controls.d.ts` is a hand-maintained type shim for those imports — keep it in sync when the controls API changes. Generated bindings live in `frontend/wailsjs/` (do not edit by hand).
- **usfm-controls** React tests use happy-dom (`tests/dom-setup.ts`, `tests/testing-react.ts`). CodeMirror-heavy suites pass `flushTimers: true` to `registerDomTestHooks()` so pending timers finish before unmount.
- **usfm-controls** component stories use [Ladle](https://ladle.dev/) via Deno (`deno task ladle` / `deno task ladle:build` in `packages/usfm-controls/`). Ladle runs through Vite with `--node-modules-dir=auto` (see that package’s `deno.json` tasks). `vite.config.ts` uses `@vitejs/plugin-react` (Babel) instead of Ladle’s default SWC plugin so no Node.js/npm CLI is required for postinstall scripts. Config lives in `.ladle/` and `vite.config.ts`. Ladle may create a gitignored `node_modules/` at the repo root; `./build.sh` removes it so tests resolve npm packages from Deno’s cache without requiring the npm CLI.
