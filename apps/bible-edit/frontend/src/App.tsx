import { useMemo } from "react";
import { UsfmShell } from "@usfm-tools/controls";
import { createWailsUsfmShellHost } from "./host";

export function App() {
  const host = useMemo(() => createWailsUsfmShellHost(), []);
  return <UsfmShell host={host} className="h-screen" />;
}
