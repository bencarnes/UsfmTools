import type { Meta, StoryObj } from "@storybook/react";
import { useMemo } from "react";
import { UsfmShell } from "./UsfmShell.js";
import { createFixtureUsfmShellHost } from "./fixture-host.js";

const meta: Meta<typeof UsfmShell> = {
  title: "Controls/UsfmShell",
  component: UsfmShell,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const STORY_HEIGHT = "720px";
const STORY_MAX_WIDTH = "1560px";

function StoryFrame({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="box-border p-4" style={{ maxWidth: STORY_MAX_WIDTH }}>
      <div className="overflow-hidden rounded border border-gray-300" style={{ height: STORY_HEIGHT }}>
        {children}
      </div>
    </div>
  );
}

export const Default: Story = {
  render: () => {
    const host = useMemo(() => createFixtureUsfmShellHost(), []);
    return (
      <StoryFrame>
        <UsfmShell host={host} />
      </StoryFrame>
    );
  },
};

export const SidebarCollapsed: Story = {
  render: () => {
    const host = useMemo(() => createFixtureUsfmShellHost(), []);
    return (
      <StoryFrame>
        <UsfmShell host={host} defaultSidebarExpanded={false} />
      </StoryFrame>
    );
  },
};

export const BottomBarCollapsed: Story = {
  render: () => {
    const host = useMemo(() => createFixtureUsfmShellHost(), []);
    return (
      <StoryFrame>
        <UsfmShell host={host} defaultBottomExpanded={false} />
      </StoryFrame>
    );
  },
};
