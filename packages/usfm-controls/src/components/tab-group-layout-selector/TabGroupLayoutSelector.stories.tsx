import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { WorkspaceGridDimension } from "../usfm-workspace/workspace-model.js";
import { TabGroupLayoutSelector } from "./TabGroupLayoutSelector.js";

const meta: Meta<typeof TabGroupLayoutSelector> = {
  title: "Controls/TabGroupLayoutSelector",
  component: TabGroupLayoutSelector,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
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
  },
};
