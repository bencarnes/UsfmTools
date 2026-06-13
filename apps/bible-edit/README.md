# BibleEdit

Desktop USFM editor built with [Wails](https://wails.io/). It hosts the shared **`UsfmShell`** from `@usfm-tools/controls` and bridges file I/O through Go so the webview cannot read or write arbitrary paths.

## Security model

All file access from the frontend goes through Go methods on `App` (`ReadFile`, `WriteFile`). A dedicated file service enforces an allowlist before any disk I/O:

| Kind | Rule | Example |
|------|------|---------|
| USFM | Extension `.usfm` or `.sfm` (case-insensitive), any directory | `/projects/bible/GEN.usfm` |
| Session | Exact basename `BibleEdit_Session.json`, any directory | `~/.config/BibleEdit/BibleEdit_Session.json` |

Everything else is rejected with `access denied`. There is no path-prefix restriction — only the filename/extension rules above.

The session file stores the current USFM folder, recent folders, and UI settings (theme). By default it is written to `$XDG_CONFIG_HOME/BibleEdit/BibleEdit_Session.json` (or the platform equivalent).

## Layout

```
apps/bible-edit/
  main.go, app.go          # Wails entry + bound methods
  internal/files/          # Allowlist + read/write service
  internal/session/        # Session JSON types
  frontend/                # React + Vite UI (UsfmShell)
```

## Prerequisites

- Go 1.22+
- [Wails v2](https://wails.io/docs/gettingstarted/installation) CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- Linux: `libgtk-3-dev`, `libwebkit2gtk-4.1-dev` (Ubuntu 24.04+). If only WebKitGTK 4.1 is available, pass `-tags webkit2_41` to `wails build` (the included `build.sh` does this automatically).
- Node.js (for the frontend bundle)

## Development

From `apps/bible-edit`:

```bash
cd frontend && npm install && cd ..
wails dev
```

`wails dev` runs the Vite dev server and opens the desktop window with hot reload.

## Build

```bash
./build.sh
```

Or manually:

```bash
cd frontend && npm install && npm run build && cd ..
wails build -tags webkit2_41   # omit -tags on systems with webkit2gtk-4.0
```

The binary is emitted as `build/bin/BibleEdit` (platform name may vary).

## Go tests

```bash
cd apps/bible-edit
go test ./...
```
