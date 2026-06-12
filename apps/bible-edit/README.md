# Bible Edit

Desktop USFM editor built with [Forge](https://forge-deno.com/) and [`UsfmShell`](../../packages/usfm-controls/README.md) from `@usfm-tools/controls`.

Bible Edit hosts the full shell UI (file browser, search, workspace tabs, settings, and diagnostics) and reads USFM files from a folder you choose. The selected folder is remembered in a session file under the Forge app-data directory.

## Requirements

- [Deno 2+](https://docs.deno.com/runtime/getting_started/installation/)
- [Forge](https://forge-deno.com/) CLI (`curl -fsSL https://forge-deno.com/install.sh | sh`)

## Quick start

From the repository root:

```bash
cd apps/bible-edit
deno task build:web   # bundle the React UI into web/dist/
forge dev .           # launch the desktop app
```

On first launch the app uses, in order:

1. The folder saved in `{appData}/session.json`, if it still exists
2. `./bibles/bsb/usfm` when running from this repository
3. `{appData}/usfm/` (created if needed)

Use **Choose USFM folder…** in the sidebar to pick a different corpus directory.

## Project layout

```
apps/bible-edit/
├── manifest.app.toml   # Forge metadata and FS/UI permissions
├── deno.json
├── src/
│   ├── main.ts         # Deno entry: IPC, dialogs, filesystem host
│   ├── session.ts      # Persist session.json in app data
│   ├── usfm-folder.ts  # List/read USFM files for UsfmShellHost
│   └── …               # Pure helpers used by tests
├── web/
│   ├── main.tsx        # React root mounting UsfmShell
│   ├── ipc.ts          # Renderer-side UsfmShellHost over IPC
│   └── dist/           # Vite build output (gitignored)
└── tests/              # Unit tests (no Forge runtime required)
```

## Tasks

| Task | Command |
|------|---------|
| Unit tests | `deno task test` |
| Type-check | `deno task check` |
| Build web UI | `deno task build:web` |
| Rebuild web on change | `deno task dev:web` |

## Security

`manifest.app.toml` declares static filesystem permissions:

- **Personal data:** write access is limited to `session.json` and `settings.json` under the Forge app-data directory.
- **USFM corpus:** read/write is granted for `./bibles/**` (bundled sample corpus) so development works out of the box.

Forge manifests cannot express arbitrary user-selected paths at runtime. Folders outside the declared globs require adding matching patterns before shipping a production build. In `forge dev`, all capabilities are granted by default.

## IPC channels

The renderer talks to `src/main.ts` on `bible-edit:*` channels (`list-files`, `read-file`, `pick-folder`, `load-settings`, `save-settings`). Channel names are allowlisted in `manifest.app.toml`.
