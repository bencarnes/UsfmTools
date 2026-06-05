import type { Meta, StoryObj } from "@storybook/react";
import { useMemo } from "react";
import { SettingsPane } from "./SettingsPane.js";
import { SettingsProvider } from "./settings-context.js";
import type { ApplicationSettings, SettingsHost } from "./settings-model.js";

const meta: Meta<typeof SettingsPane> = {
  title: "Controls/SettingsPane",
  component: SettingsPane,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** In-memory settings host that logs saves to the Actions panel. */
function makeStoryHost(initial: ApplicationSettings | null): SettingsHost {
  let current = initial;
  return {
    async loadSettings() {
      return current;
    },
    async saveSettings(next) {
      current = next;
      console.log("saveSettings", next);
    },
  };
}

function StoryFrame({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="box-border p-4" style={{ maxWidth: "960px" }}>
      <div className="overflow-hidden rounded border border-gray-300" style={{ height: "480px" }}>
        {children}
      </div>
    </div>
  );
}

export const Default: Story = {
  render: () => {
    const host = useMemo(() => makeStoryHost(null), []);
    return (
      <SettingsProvider host={host}>
        <StoryFrame>
          <SettingsPane className="h-full" />
        </StoryFrame>
      </SettingsProvider>
    );
  },
};

export const DarkPersisted: Story = {
  render: () => {
    const host = useMemo(() => makeStoryHost({ theme: "dark" }), []);
    return (
      <SettingsProvider host={host}>
        <StoryFrame>
          <SettingsPane className="h-full" />
        </StoryFrame>
      </SettingsProvider>
    );
  },
};
