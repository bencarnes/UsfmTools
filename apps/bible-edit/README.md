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

## Drag-and-drop in the webview

Tab dragging in `UsfmShell` is implemented with **pointer events**, not the HTML5 DnD (Drag and Drop) API. On Linux, Wails renders in WebKitGTK, whose HTML5 DnD drop-target events (`dragenter`/`dragover`/`drop`) are unreliable: a drag visibly starts but no target ever accepts it, so the cursor stays "not allowed". The same code works in WebView2 (Windows) and WKWebView (macOS) but fails on Linux.

No Wails/Go option fixes this — `options.App.DragAndDrop{ EnableFileDrop }` only governs dropping OS files into the window, not dragging DOM elements between each other. Prefer pointer events (the approach the split resizers and tab dragging already use) for any future drag features.

## System theme detection in the webview

The `prefers-color-scheme` media query does **not** track the OS light/dark setting in the Linux WebKitGTK webview — it stays fixed regardless of the desktop theme. This works as expected in WebView2 (Windows) and WKWebView (macOS) but not on Linux.

This is an accepted limitation. Working around it (e.g. querying the GTK theme through Go and pushing it to the frontend) would add cross-platform complexity that isn't worth it; users can always set the theme explicitly in settings. Don't try to make automatic system-theme following work on Linux.

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

On systems that only have WebKitGTK 4.1 (Ubuntu 24.04+), the default `wails dev`
fails to compile with `Package 'webkit2gtk-4.0' ... not found`. Pass the same tag
`build.sh` uses for builds:

```bash
wails dev -tags webkit2_41
```

The app runs in the native window `wails dev` opens — not in the browser. The
URLs printed in the terminal are for debugging: only the Wails dev server
(`http://localhost:34115`) injects the Go bindings, so the raw Vite URL renders a
blank page for this app.

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
