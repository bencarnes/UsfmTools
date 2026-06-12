# UsfmTools

TypeScript libraries and UI for working with [USFM](https://ubsicap.github.io/usfm/) (Unified Standard Format Markers), a plain-text convention used for Bible translation files.

## Architecture

Consumable libraries live under `packages/` as a **Deno workspace** (see root `deno.json`). Build and test **bottom-up**: the parser is the foundation; the model and UI layers sit on top. Desktop apps live under `apps/`.

```mermaid
flowchart TB
  subgraph packages["packages/"]
    parser["usfm-parser\n(grammar, parse tree, USFM core)"]
    model["usfm-model\n(indexing, queries on parse output)"]
    controls["usfm-controls\n(React + CodeMirror editor)"]
    integ["usfm-parser-integration-tests\n(Deno tests vs sample corpus)"]
  end
  subgraph apps["apps/"]
    bibleEdit["bible-edit\n(Forge desktop app, UsfmShell)"]
  end
  parser --> model
  parser --> controls
  model --> controls
  parser --> integ
  controls --> bibleEdit
```

| Name | Role |
|--------|------|
| **usfm-parser** | Parses USFM source into structured data; exports TypeScript from `src/`. |
| **usfm-model** | View models (for example `ViewModels.Publication` / `PublicationViewModel`), publication-style HTML rendering via **`renderPreviewHtml`**, standard USFM **book identifier** metadata and **`buildUsfmBookPickerGroups`**, **`listChapterNumbersFromBook`**, plus re-exports of **`parse`**. |
| **usfm-controls** | React controls: **`UsfmEditor`** (CodeMirror, with find/replace via **Ctrl+F** / **Ctrl+H**), **`UsfmPreview`**, **`UsfmBookPicker`**, **`ChapterPicker`**, **`UsfmShell`**, and the async USFM language service. Depends on the parser and model. |
| **usfm-parser-integration-tests** | Longer-running checks against the parser; tests only (no separate check task). |
| **bible-edit** (`apps/bible-edit/`) | [Forge](https://forge-deno.com/) desktop app that hosts **`UsfmShell`** with real filesystem access. See **`apps/bible-edit/README.md`**. |

The **`Plan/`** directory holds Obsidian-style planning notes and is not part of the build.

## Requirements

- **[Deno 2+](https://docs.deno.com/runtime/getting_started/installation/)**

## Build and test everything

From the repository root:

```bash
./build.sh
```

This runs `deno task check` on parser, model, controls, and bible-edit, then `deno task test` on all workspace packages and apps in dependency order.

You can also use workspace tasks directly:

```bash
deno task check   # type-check libraries
deno task test    # run all package tests
deno task lint    # lint packages/
```

### Bible Edit desktop app

Forge-based editor for local USFM folders. From `apps/bible-edit/`:

```bash
deno task test        # unit tests
deno task build:web   # bundle React UI for Forge
forge dev .           # run the desktop app (requires Forge CLI)
```

See **`apps/bible-edit/README.md`** for permissions, IPC, and folder-picker behavior.

## Per-package commands

Run from a package directory (for example `packages/usfm-parser/`) or app directory (`apps/bible-edit/`):

| Task | Command |
|------|---------|
| Type-check | `deno task check` |
| Test | `deno task test` |
| Lint | `deno task lint` |

### Component stories (usfm-controls)

Interactive component development uses [Ladle](https://ladle.dev/), run via Deno from `packages/usfm-controls/`:

```bash
cd packages/usfm-controls
deno task ladle        # dev server (default http://localhost:61000/)
deno task ladle:build  # static build to build/
```

Stories live next to components as `*.stories.tsx`. The first run may download npm dependencies into a workspace `node_modules/` directory (gitignored).

## Contributing

See **`AGENTS.md`** for tooling notes used in automated environments.
