import type { Story, StoryDefault } from "@ladle/react";
import { useState } from "react";
import type { WorkspaceGridDimension } from "../usfm-workspace/workspace-model.js";
import { TabGroupLayoutSelector } from "./TabGroupLayoutSelector.js";

export default {
  title: "Controls/TabGroupLayoutSelector",
} satisfies StoryDefault;

export const Default: Story = () => {
  const [rows, setRows] = useState<WorkspaceGridDimension>(1);
  const [cols, setCols] = useState<WorkspaceGridDimension>(2);
  return (
    <div className="flex items-center gap-3 p-4">
      <TabGroupLayoutSelector
        gridRows={rows}
        gridCols={cols}
        onChange={(r, c) => {
          setRows(r);
          setCols(c);
        }}
      />
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Layout: {rows}×{cols}
      </span>
    </div>
  );
};
