import { createWindow, dialog } from "runtime:window";
import { sendToWindow, windowEvents } from "runtime:ipc";
import { exists, readTextFile, writeTextFile } from "runtime:fs";
import type { ApplicationSettings } from "@usfm-tools/controls";
import { DEFAULT_APPLICATION_SETTINGS } from "@usfm-tools/controls";
import { settingsFilePath } from "./session.js";
import { UsfmFolderHost } from "./usfm-folder.js";

const CHANNEL_PREFIX = "bible-edit";

async function loadSettings(): Promise<ApplicationSettings | null> {
  const path = await settingsFilePath();
  try {
    if (!(await exists(path))) return null;
    return JSON.parse(await readTextFile(path)) as ApplicationSettings;
  } catch (error) {
    console.warn("Failed to load settings.", error);
    return null;
  }
}

async function saveSettings(settings: ApplicationSettings): Promise<void> {
  const path = await settingsFilePath();
  await writeTextFile(path, JSON.stringify(settings, null, 2));
}

async function main() {
  console.log("Bible Edit starting…");

  const usfmHost = new UsfmFolderHost();
  await usfmHost.initialize();

  const win = await createWindow({
    url: "app://dist/index.html",
    width: 1280,
    height: 860,
    title: "Bible Edit",
  });

  function hostSnapshot() {
    return { label: usfmHost.label, folderPath: usfmHost.folderPath };
  }

  async function respond(requestId: string, result: unknown) {
    await sendToWindow(win.id, `${CHANNEL_PREFIX}:response`, { requestId, ok: true, result });
  }

  async function respondError(requestId: string, message: string) {
    await sendToWindow(win.id, `${CHANNEL_PREFIX}:response`, {
      requestId,
      ok: false,
      error: message,
    });
  }

  for await (const event of windowEvents()) {
    if (event.windowId !== win.id) continue;

    const payload = event.payload as { requestId?: string; data?: unknown } | undefined;
    const requestId = payload?.requestId;
    const data = payload?.data;

    switch (event.channel) {
      case `${CHANNEL_PREFIX}:ready`:
        await sendToWindow(win.id, `${CHANNEL_PREFIX}:host-state`, hostSnapshot());
        break;

      case `${CHANNEL_PREFIX}:list-files`:
        if (!requestId) break;
        try {
          await respond(requestId, await usfmHost.listFiles());
        } catch (error) {
          await respondError(requestId, error instanceof Error ? error.message : String(error));
        }
        break;

      case `${CHANNEL_PREFIX}:read-file`:
        if (!requestId) break;
        try {
          const fileId = data as string;
          await respond(requestId, await usfmHost.readFile(fileId));
        } catch (error) {
          await respondError(requestId, error instanceof Error ? error.message : String(error));
        }
        break;

      case `${CHANNEL_PREFIX}:pick-folder`: {
        if (!requestId) break;
        try {
          const selected = await dialog.open({
            title: "Choose USFM folder",
            defaultPath: usfmHost.folderPath ?? undefined,
            directory: true,
          });
          if (selected?.[0]) {
            await usfmHost.setFolder(selected[0]);
            await sendToWindow(win.id, `${CHANNEL_PREFIX}:host-state`, hostSnapshot());
          }
          await respond(requestId, hostSnapshot());
        } catch (error) {
          await respondError(requestId, error instanceof Error ? error.message : String(error));
        }
        break;
      }

      case `${CHANNEL_PREFIX}:load-settings`:
        if (!requestId) break;
        try {
          const settings = (await loadSettings()) ?? DEFAULT_APPLICATION_SETTINGS;
          await respond(requestId, settings);
        } catch (error) {
          await respondError(requestId, error instanceof Error ? error.message : String(error));
        }
        break;

      case `${CHANNEL_PREFIX}:save-settings`:
        if (!requestId) break;
        try {
          await saveSettings(data as ApplicationSettings);
          await respond(requestId, null);
        } catch (error) {
          await respondError(requestId, error instanceof Error ? error.message : String(error));
        }
        break;

      default:
        break;
    }
  }
}

main().catch(console.error);
