import { useId } from "react";
import { useSettings } from "./settings-context.js";
import { UI_THEME_OPTIONS } from "./settings-model.js";

export interface SettingsPaneProps {
  readonly className?: string;
}

/**
 * A workspace pane for editing application settings. Currently exposes a single setting — the color
 * theme — as a set of radio options. Reads and writes the settings store directly via
 * {@link useSettings}, so it must be rendered within a `SettingsProvider`. Theming is not yet wired
 * up; this only persists the preference.
 */
export function SettingsPane({ className }: SettingsPaneProps) {
  const { settings, setTheme } = useSettings();
  const themeGroupName = useId();

  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-white ${className ?? ""}`}
      data-testid="settings-pane"
    >
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>

        <section className="mt-6" aria-labelledby={`${themeGroupName}-label`}>
          <h2 id={`${themeGroupName}-label`} className="text-sm font-semibold text-gray-900">
            Theme
          </h2>
          <p className="mt-1 text-sm text-gray-500">Choose how USFM Tools looks.</p>

          <div role="radiogroup" aria-labelledby={`${themeGroupName}-label`} className="mt-3 flex flex-col gap-2">
            {UI_THEME_OPTIONS.map((opt) => {
              const selected = opt.value === settings.theme;
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded border px-3 py-2 ${
                    selected ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-50"
                  }`}
                  data-testid={`settings-theme-option-${opt.value}`}
                >
                  <input
                    type="radio"
                    name={themeGroupName}
                    value={opt.value}
                    checked={selected}
                    onChange={() => setTheme(opt.value)}
                    className="mt-0.5"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                    <span className="text-xs text-gray-500">{opt.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
