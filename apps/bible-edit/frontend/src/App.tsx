import { useEffect, useMemo, useRef } from "react";
import { UsfmShell, type UsfmShellHandle } from "@usfm-tools/controls";
import { EventsOn } from "../wailsjs/runtime/runtime.js";
import { AllowQuitAndExit } from "../wailsjs/go/main/App.js";
import { createWailsUsfmShellHost } from "./host";
import { createWailsLanguageClient } from "./language-client";

export function App() {
  const host = useMemo(() => createWailsUsfmShellHost(), []);
  const languageClient = useMemo(() => createWailsLanguageClient(), []);
  const shellRef = useRef<UsfmShellHandle>(null);

  useEffect(() => {
    return EventsOn("window:close-requested", () => {
      void (async () => {
        const ok = (await shellRef.current?.confirmExit()) ?? true;
        if (ok) {
          AllowQuitAndExit();
        }
      })();
    });
  }, []);

  return (
    <UsfmShell ref={shellRef} host={host} languageClient={languageClient} className="h-screen" />
  );
}
