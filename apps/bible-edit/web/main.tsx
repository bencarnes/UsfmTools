import { useEffect, useMemo, useState } from "react";
import { UsfmShell, type UsfmShellHost } from "@usfm-tools/controls";
import "./styles.css";
import {
  forgeListFiles,
  forgeLoadSettings,
  forgePickFolder,
  forgeReadFile,
  forgeSaveSettings,
  signalReady,
  subscribeHostState,
  type ForgeHostState,
} from "./ipc.js";

function useForgeUsfmShellHost(): UsfmShellHost {
  const [hostState, setHostState] = useState<ForgeHostState>({
    label: "Loading…",
    folderPath: null,
  });

  useEffect(() => {
    signalReady();
    return subscribeHostState((payload) => {
      setHostState(payload as ForgeHostState);
    });
  }, []);

  return useMemo(
    (): UsfmShellHost => ({
      label: hostState.label,
      async listFiles() {
        return await forgeListFiles();
      },
      async readFile(fileId) {
        return await forgeReadFile(fileId);
      },
      async pickFolder() {
        const next = await forgePickFolder();
        setHostState(next);
      },
      async loadSettings() {
        return await forgeLoadSettings();
      },
      async saveSettings(settings) {
        await forgeSaveSettings(settings);
      },
    }),
    [hostState.label],
  );
}

export function App() {
  const host = useForgeUsfmShellHost();

  return (
    <div className="h-full min-h-0" data-testid="bible-edit-app">
      <UsfmShell host={host} className="h-full" />
    </div>
  );
}
