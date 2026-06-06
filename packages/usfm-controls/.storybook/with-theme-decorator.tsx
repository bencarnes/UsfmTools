import type { Decorator } from "@storybook/react";
import { ThemeScope } from "../src/components/settings-pane/theme-scope";

/** For stories that do not bring their own {@link SettingsProvider}. */
export const withSystemTheme: Decorator = (Story) => (
  <ThemeScope theme="system">
    <Story />
  </ThemeScope>
);
