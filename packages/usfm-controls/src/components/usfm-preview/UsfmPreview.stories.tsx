import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { UsfmEditor } from "../usfm-editor/UsfmEditor.js";
import { UsfmPreview } from "./UsfmPreview.js";

const meta = {
  title: "Controls/UsfmPreview",
  component: UsfmPreview,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof UsfmPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE = `\\id GEN Sample
\\h Genesis
\\c 1
\\s1 The Creation
\\p \\v 1 In the beginning God created the heavens and the earth.
\\q1 \\v 2 Now the earth was \\nd void\\nd* and without form.`;

export const GenesisPreview: Story = {
  args: {
    value: SAMPLE,
    className: "max-w-prose border border-gray-200 rounded-md p-4 bg-white",
  },
};

export const WithEditor: Story = {
  args: {
    value: SAMPLE,
    className: "",
  },
  render: () => {
    const [value, setValue] = useState(SAMPLE);
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[min(90vh,720px)]">
        <div className="flex flex-col min-h-0">
          <p className="text-sm text-gray-600 mb-1">USFM source</p>
          <UsfmEditor value={value} onChange={setValue} className="flex-1 min-h-[200px]" />
        </div>
        <div className="flex flex-col min-h-0 overflow-auto">
          <p className="text-sm text-gray-600 mb-1">Preview (updates as you type)</p>
          <UsfmPreview
            value={value}
            className="flex-1 overflow-auto max-w-prose border border-gray-200 rounded-md p-4 bg-amber-50/30"
          />
        </div>
      </div>
    );
  },
};
