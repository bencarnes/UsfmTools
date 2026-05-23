# bible-edit

Desktop shell for a future USFM Bible editor. This **application** (not a consumable npm package under `packages/`) is a [Tauri](https://tauri.app/) app using **React**, **TypeScript**, **Vite**, and **Tailwind CSS**.

Today the UI is only a centered placeholder line of text. The actual Bible editor will be added in a later iteration.

## Design

**Goal.** `bible-edit` is intended to become a USFM Bible editor: load and edit scripture marked up in [USFM](https://ubsicap.github.io/usfm/), with a native desktop experience via Tauri.

**Stack.**

- **Tauri** hosts a small Rust process (`src-tauri/`) that owns the native window, packaging, and (later) file system or OS integration. The frontend is a Vite-built web UI loaded in a WebView.
- **React** is the UI layer (`src/`). State, editor widgets, and layout will live here as the product grows.
- **Tailwind CSS** (via `@tailwindcss/vite`) supplies utility-first styling so layout and theming stay colocated with components.
- **Vite** bundles the React app for `tauri dev` / `tauri build` using the paths declared in `src-tauri/tauri.conf.json` (`devUrl`, `frontendDist`).

**Current shape.** The Rust side is minimal (no custom commands yet). The React tree is a single root component that reads copy from `src/placeholder.ts` so tests and UI stay aligned. When the real editor lands, expect more crates (or modules) for file I/O and IPC, and a richer React tree (editor surface, toolbar, status).

**Repository layout.** The app lives at **`bible-edit/`** in the UsfmTools repository root, alongside the `packages/` tree of shared libraries. It does not yet depend on `usfm-parser` or other workspace packages; wiring those in will be part of editor implementation.

## Prerequisites

- **Node.js 20.19+ or 22.12+** (Vite 7 requirement). Node 22 LTS is recommended.
- **npm 10+** (npm 11 recommended). The npm bundled with Node 22 (10.9.x) works; to upgrade to latest, `corepack install -g npm@latest` avoids the self-upgrade race that `npm install -g npm@latest` can trigger on system installs.
- **Rust** (stable) and your platform's [Tauri prerequisites](https://tauri.app/start/prerequisites/).

**Linux (Debian/Ubuntu) system packages.** Tauri's Rust build links against GTK and WebKitGTK; in particular, `gdk-sys` requires `gdk-3.0.pc` (from `libgtk-3-dev`), which is not always pulled in by `libwebkit2gtk-4.1-dev` alone. Install the full set:

```bash
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  build-essential curl wget file
```

Verify with `pkg-config --modversion gdk-3.0 webkit2gtk-4.1`.

## Build and run

From the repository root:

```bash
cd bible-edit
npm install
```

**Frontend only (browser, no native shell):** useful for quick UI checks.

```bash
npm run dev
```

Then open the URL Vite prints (by default `http://localhost:1420`; this project pins port `1420` for Tauri).

**Full desktop app (WebView + Rust):**

```bash
npm run tauri dev
```

**Production artifacts:**

```bash
npm run build          # Typecheck + Vite build → dist/
npm run tauri build    # Native bundles (installer / app image per OS)
```

## Tests

Unit tests use **Vitest** and **React Testing Library** (`jsdom`). They cover the placeholder string module and the root React component.

```bash
npm test           # single run (CI)
npm run test:watch # watch mode while developing
```

## IDE

[VS Code](https://code.visualstudio.com/) with the [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) and [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) extensions is a good default setup.
