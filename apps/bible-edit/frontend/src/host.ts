import type { ApplicationSettings, UsfmShellHost } from "@usfm-tools/controls";
import {
  GetHostInfo,
  ListRecentFolders,
  ListUsfmFiles,
  LoadSettings,
  OpenFolder,
  PickFolder,
  ReadFile,
  SaveSettings,
  WriteFile,
} from "../wailsjs/go/main/App.js";

type HostInfo = {
  label: string;
  folderPath: string;
};

let cachedHostInfo: HostInfo = { label: "No folder open", folderPath: "" };

async function refreshHostInfo(): Promise<HostInfo> {
  cachedHostInfo = await GetHostInfo();
  return cachedHostInfo;
}

/** Wails-backed {@link UsfmShellHost} with Go-enforced file access rules. */
export function createWailsUsfmShellHost(): UsfmShellHost {
  void refreshHostInfo();

  return {
    get label() {
      return cachedHostInfo.label;
    },
    get folderPath() {
      return cachedHostInfo.folderPath;
    },
    async listRecentFolders() {
      return ListRecentFolders();
    },
    async openFolder(path: string) {
      await OpenFolder(path);
      await refreshHostInfo();
    },
    async pickFolder() {
      await PickFolder();
      await refreshHostInfo();
    },
    async listFiles() {
      const info = await refreshHostInfo();
      if (!info.folderPath) {
        return [];
      }
      return ListUsfmFiles(info.folderPath);
    },
    async readFile(fileId: string) {
      try {
        return await ReadFile(fileId);
      } catch {
        return null;
      }
    },
    async writeFile(fileId: string, content: string) {
      await WriteFile(fileId, content);
    },
    async loadSettings() {
      const settings = await LoadSettings();
      if (!settings?.theme) {
        return null;
      }
      return settings as ApplicationSettings;
    },
    async saveSettings(settings: ApplicationSettings) {
      await SaveSettings(settings);
    },
  };
}
