import type { Story, StoryDefault } from "@ladle/react";
import { useMemo } from "react";
import { UsfmShell } from "./UsfmShell.js";
import { createFixtureUsfmShellHost } from "./fixture-host.js";

export default {
  title: "Controls/UsfmShell",
} satisfies StoryDefault;

const STORY_HEIGHT = "720px";
const STORY_MAX_WIDTH = "1560px";

function StoryFrame({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="box-border p-4" style={{ maxWidth: STORY_MAX_WIDTH }}>
      <div
        className="h-full overflow-hidden rounded border border-gray-300 dark:border-gray-600"
        style={{ height: STORY_HEIGHT }}
      >
        {children}
      </div>
    </div>
  );
}

export const Default: Story = () => {
  const host = useMemo(() => createFixtureUsfmShellHost(), []);
  return (
    <StoryFrame>
      <UsfmShell host={host} />
    </StoryFrame>
  );
};

export const SidebarCollapsed: Story = () => {
  const host = useMemo(() => createFixtureUsfmShellHost(), []);
  return (
    <StoryFrame>
      <UsfmShell host={host} defaultSidebarExpanded={false} />
    </StoryFrame>
  );
};

export const BottomBarCollapsed: Story = () => {
  const host = useMemo(() => createFixtureUsfmShellHost(), []);
  return (
    <StoryFrame>
      <UsfmShell host={host} defaultBottomExpanded={false} />
    </StoryFrame>
  );
};
