import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { UsfmEditor } from "../usfm-editor/UsfmEditor.js";
import { UsfmPreview } from "./UsfmPreview.js";

const MULTI_VERSE_PARAGRAPH = `\\id GEN Sample
\\h Genesis
\\c 1
\\s1 The Creation
\\p \\v 1 In the beginning God created the heavens and the earth. \\v 2 Now the earth was \\nd void\\nd* and without form.`;

const meta = {
  title: "Controls/UsfmPreview",
  component: UsfmPreview,
  args: {
    versePerLine: false,
  },
  argTypes: {
    versePerLine: {
      control: "boolean",
      description:
        "When true, a single \\p that contains multiple \\v milestones is split so each verse appears on its own preview line.",
    },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof UsfmPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GenesisPreview: Story = {
  args: {
    value: MULTI_VERSE_PARAGRAPH,
    className: "max-w-prose border border-gray-200 rounded-md p-4 bg-white",
    versePerLine: false,
  },
};

export const WithEditor: Story = {
  args: {
    value: MULTI_VERSE_PARAGRAPH,
    className: "",
    versePerLine: false,
  },
  render: () => {
    const [value, setValue] = useState(MULTI_VERSE_PARAGRAPH);
    const [versePerLine, setVersePerLine] = useState(false);
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[min(90vh,720px)]">
        <div className="flex flex-col min-h-0">
          <p className="text-sm text-gray-600 mb-1">USFM source</p>
          <UsfmEditor value={value} onChange={setValue} className="flex-1 min-h-[200px]" />
        </div>
        <div className="flex flex-col min-h-0 overflow-auto">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm text-gray-600">Preview (updates as you type)</p>
            <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={versePerLine}
                onChange={(e) => setVersePerLine(e.target.checked)}
              />
              Verse per line
            </label>
          </div>
          <UsfmPreview
            value={value}
            versePerLine={versePerLine}
            className="flex-1 overflow-auto max-w-prose border border-gray-200 rounded-md p-4 bg-amber-50/30"
          />
        </div>
      </div>
    );
  },
};

export const VersePerLineCompare: Story = {
  args: {
    value: MULTI_VERSE_PARAGRAPH,
    className: "",
    versePerLine: false,
  },
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">versePerLine=false (default)</p>
        <UsfmPreview
          value={MULTI_VERSE_PARAGRAPH}
          className="max-w-prose border border-gray-200 rounded-md p-4 bg-white"
        />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">versePerLine=true</p>
        <UsfmPreview
          value={MULTI_VERSE_PARAGRAPH}
          versePerLine
          className="max-w-prose border border-gray-200 rounded-md p-4 bg-white"
        />
      </div>
    </div>
  ),
};
