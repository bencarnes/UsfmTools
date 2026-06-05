import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_APPLICATION_SETTINGS,
  type ApplicationSettings,
  type SettingsHost,
  type UiTheme,
} from "./settings-model.js";

export interface SettingsContextValue {
  /** Current settings. Equals {@link DEFAULT_APPLICATION_SETTINGS} until the host load resolves. */
  readonly settings: ApplicationSettings;
  /** True while the initial load from the host is in flight. */
  readonly loading: boolean;
  /** Replace all settings. Updates state immediately and persists via the host. */
  setSettings(next: ApplicationSettings): void;
  /** Convenience updater for the theme setting. */
  setTheme(theme: UiTheme): void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export interface SettingsProviderProps {
  /** Backend that loads and persists settings (typically the shell host). */
  readonly host: SettingsHost;
  readonly children: ReactNode;
}

/**
 * Owns settings state and its persistence lifecycle. Loads once from the host on mount and writes
 * back through the host on every change, so neither the shell nor the workspace has to mediate
 * settings changes — the {@link SettingsPane} reads and updates this store directly.
 */
export function SettingsProvider({ host, children }: SettingsProviderProps) {
  const [settings, setSettingsState] = useState<ApplicationSettings>(DEFAULT_APPLICATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const hostRef = useRef(host);
  hostRef.current = host;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    host
      .loadSettings()
      .then((loaded) => {
        if (cancelled) return;
        if (loaded) setSettingsState({ ...DEFAULT_APPLICATION_SETTINGS, ...loaded });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [host]);

  const setSettings = useCallback((next: ApplicationSettings) => {
    setSettingsState(next);
    void hostRef.current.saveSettings(next);
  }, []);

  const setTheme = useCallback(
    (theme: UiTheme) => {
      setSettingsState((prev) => {
        if (prev.theme === theme) return prev;
        const next = { ...prev, theme };
        void hostRef.current.saveSettings(next);
        return next;
      });
    },
    [],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, loading, setSettings, setTheme }),
    [settings, loading, setSettings, setTheme],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Read the settings store. Must be called within a {@link SettingsProvider}. */
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a <SettingsProvider>.");
  }
  return ctx;
}
