declare module "@usfm-tools/controls" {
  import type { ComponentType, ReactNode } from "react";

  export type UiTheme = "light" | "dark" | "system";

  export interface ApplicationSettings {
    readonly theme: UiTheme;
  }

  export interface UsfmShellFileEntry {
    readonly id: string;
    readonly name: string;
  }

  export interface UsfmShellRecentFolder {
    readonly path: string;
    readonly label: string;
  }

  export interface UsfmShellHost {
    readonly label: string;
    readonly folderPath: string;
    listRecentFolders(): Promise<readonly UsfmShellRecentFolder[]>;
    openFolder(path: string): Promise<void>;
    pickFolder(): Promise<void>;
    listFiles(): Promise<readonly UsfmShellFileEntry[]>;
    readFile(fileId: string): Promise<string | null>;
    readFilePickerHeader?(fileId: string): Promise<string | null>;
    writeFile?(fileId: string, content: string): Promise<void>;
    loadSettings(): Promise<ApplicationSettings | null>;
    saveSettings(settings: ApplicationSettings): Promise<void>;
  }

  export interface UsfmShellProps {
    readonly host: UsfmShellHost;
    readonly defaultSidebarExpanded?: boolean;
    readonly defaultBottomExpanded?: boolean;
    readonly className?: string;
  }

  export const UsfmShell: ComponentType<UsfmShellProps>;
}

declare module "@usfm-tools/controls/styles.css";
