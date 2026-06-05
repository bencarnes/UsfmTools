/**
 * User-configurable settings surfaced by the {@link SettingsPane}. Persisted through the
 * {@link import("../usfm-shell/host.js").UsfmShellHost} so the production app (Tauri/Electron)
 * and the Storybook fixture share the same shape.
 */

/** Color theme preference. `system` follows the OS setting. (Theming itself is not yet implemented.) */
export type UiTheme = "light" | "dark" | "system";

export interface ApplicationSettings {
  readonly theme: UiTheme;
}

/** Defaults used until a host returns persisted settings. */
export const DEFAULT_APPLICATION_SETTINGS: ApplicationSettings = {
  theme: "system",
};

export interface UiThemeOption {
  readonly value: UiTheme;
  readonly label: string;
  readonly description: string;
}

/** Selectable theme options, in display order. */
export const UI_THEME_OPTIONS: readonly UiThemeOption[] = [
  { value: "light", label: "Light", description: "Always use the light theme." },
  { value: "dark", label: "Dark", description: "Always use the dark theme." },
  { value: "system", label: "System", description: "Match your operating system setting." },
];

/**
 * Persistence backend for application settings. The full {@link UsfmShellHost} implements this,
 * but it is kept as its own narrow interface so the settings store never depends on the rest of
 * the host surface.
 */
export interface SettingsHost {
  /** Return persisted settings, or `null` if none have been saved yet (defaults are then used). */
  loadSettings(): Promise<ApplicationSettings | null>;
  /** Persist the given settings. */
  saveSettings(settings: ApplicationSettings): Promise<void>;
}
