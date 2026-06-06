import type { Preview } from "@storybook/react";
import { ThemeScope } from "../src/components/settings-pane/theme-scope";
import "../src/styles.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeScope theme="system">
        <Story />
      </ThemeScope>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
