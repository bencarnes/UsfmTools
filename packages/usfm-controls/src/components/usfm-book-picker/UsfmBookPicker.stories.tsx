import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { UsfmBookPickerFileInput } from "@usfm-tools/model";
import { UsfmBookPicker } from "./UsfmBookPicker.js";

const SAMPLE_FILES: readonly UsfmBookPickerFileInput[] = [
  {
    id: "gen",
    usfm: `\\id GEN
\\toc3 Gen
\\toc1 Genesis
\\c 1
\\p
\\v 1 In the beginning.`,
  },
  {
    id: "mat",
    usfm: `\\id MAT
\\toc3 Mat
\\toc1 Matthew
\\c 1
\\p
\\v 1 Book of the genealogy.`,
  },
  {
    id: "tob",
    usfm: `\\id TOB
\\toc1 Tobit
\\toc2 Tb
\\toc3 Tbt
\\c 1
\\p
\\v 1 This book tells the story.`,
  },
  {
    id: "bad",
    usfm: `\\id XYZ
\\toc3 Bad
\\c 1
\\p`,
  },
];

const meta = {
  title: "Controls/UsfmBookPicker",
  component: UsfmBookPicker,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof UsfmBookPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    files: SAMPLE_FILES,
  },
  render: (args) => {
    const [last, setLast] = useState<string>("(none)");
    return (
      <div className="max-w-2xl space-y-3">
        <UsfmBookPicker
          {...args}
          onBookSelect={(d) => setLast(`${d.code} → fileId ${d.fileId}`)}
          className="border border-gray-200 rounded-md p-3 bg-white"
        />
        <p className="text-sm text-gray-600">Last selection: {last}</p>
      </div>
    );
  },
};
