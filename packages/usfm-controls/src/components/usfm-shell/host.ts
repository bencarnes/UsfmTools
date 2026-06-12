import type { SettingsHost } from "../settings-pane/settings-model.js";

/**
 * Host interface that supplies the {@link UsfmShell} with access to the underlying
 * file system (or any other storage backend). The shell never touches the file
 * system directly — production hosts (for example the Tauri/Electron app) and the
 * Storybook fixture implement this same shape so the shell stays portable.
 *
 * Also persists application settings via {@link SettingsHost}.
 */
export interface UsfmShellHost extends SettingsHost {
  /**
   * Stable, human-readable label for the source — for example a folder name.
   * Shown above the file browser tab.
   */
  readonly label: string;
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
   * Prompt the user to choose the folder that supplies USFM files for the shell.
   * Implementations update {@link label} and the file list when a new folder is chosen.
   */
  pickFolder(): Promise<void>;
}

export interface UsfmShellFileEntry {
  /** Stable identifier (e.g. file path, URI). Used as the tab key + cache key. */
  readonly id: string;
  /** Display name (typically the file basename). */
  readonly name: string;
}
