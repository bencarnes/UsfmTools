import type { SettingsHost } from "../settings-pane/settings-model.js";

/**
 * Host interface that supplies the {@link UsfmShell} with access to the underlying
 * file system (or any other storage backend). The shell never touches the file
 * system directly — production hosts (for example the Tauri/Electron app) and the
 * Storybook fixture implement this same shape so the shell stays portable.
 *
 * Also persists application settings via {@link SettingsHost}.
 */
export interface UsfmShellRecentFolder {
  /** Absolute path of the folder. */
  readonly path: string;
  /** Display name (typically the folder basename). */
  readonly label: string;
}

export interface UsfmShellHost extends SettingsHost {
  /**
   * Stable, human-readable label for the source — for example a folder name.
   * Shown in the file browser folder selector.
   */
  readonly label: string;
  /** Absolute path of the currently opened folder (shown as a tooltip). */
  readonly folderPath: string;
  /** Recently opened folders, most recent first. */
  listRecentFolders(): Promise<readonly UsfmShellRecentFolder[]>;
  /** Switch to a folder by absolute path. */
  openFolder(path: string): Promise<void>;
  /** Prompt the user to pick a new folder to open. */
  pickFolder(): Promise<void>;
  /**
   * Return the list of USFM files in the currently selected folder. Just enough
   * info to populate the browser and run global search; full contents are loaded
   * lazily via {@link readFile}.
   */
  listFiles(): Promise<readonly UsfmShellFileEntry[]>;
  /**
   * Return the USFM content for a file (or `null` if the file no longer exists).
   * Called when the user opens a file and when global search needs the body.
   */
  readFile(fileId: string): Promise<string | null>;
  /**
   * Persist edited USFM for a file. When provided, the shell debounces saves on tab edits.
   * Desktop hosts implement this through a Go/Tauri file service with an allowlist.
   */
  writeFile?(fileId: string, content: string): Promise<void>;
}

export interface UsfmShellFileEntry {
  /** Stable identifier (e.g. file path, URI). Used as the tab key + cache key. */
  readonly id: string;
  /** Display name (typically the file basename). */
  readonly name: string;
}
