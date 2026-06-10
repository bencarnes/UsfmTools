import type { Story, StoryDefault } from "@ladle/react";
import type { ComponentProps } from "react";
import { useState } from "react";
import { UsfmEditor } from "../usfm-editor/UsfmEditor.js";
import { UsfmPreview } from "./UsfmPreview.js";

const MULTI_VERSE_PARAGRAPH = `\\id GEN Sample
\\h Genesis
\\c 1
\\s1 The Creation
\\p \\v 1 In the beginning God created the heavens and the earth. \\v 2 Now the earth was \\nd void\\nd* and without form.`;

const previewPanelClass =
  "max-w-prose rounded-md border border-gray-200 p-4 dark:border-gray-700";

const storyLabelClass = "mb-2 text-sm font-medium text-gray-700 dark:text-gray-300";

type UsfmPreviewArgs = ComponentProps<typeof UsfmPreview>;

export default {
  title: "Controls/UsfmPreview",
  args: {
    versePerLine: false,
  },
  argTypes: {
    versePerLine: {
      control: { type: "boolean" },
      description:
        "When true, a single \\p that contains multiple \\v milestones is split so each verse appears on its own preview line.",
    },
  },
} satisfies StoryDefault;

export const GenesisPreview: Story<UsfmPreviewArgs> = (args) => <UsfmPreview {...args} />;
GenesisPreview.args = {
  value: MULTI_VERSE_PARAGRAPH,
  className: previewPanelClass,
  versePerLine: false,
};

export const WithEditor: Story = () => {
  const [value, setValue] = useState(MULTI_VERSE_PARAGRAPH);
  const [versePerLine, setVersePerLine] = useState(false);

  return (
    <div className="grid h-[min(90vh,720px)] grid-cols-1 gap-4 md:grid-cols-2">
      <div className="flex min-h-0 flex-col">
        <p className="mb-1 text-sm text-gray-600 dark:text-gray-400">USFM source</p>
        <UsfmEditor value={value} onChange={setValue} className="min-h-[200px] flex-1" />
      </div>
      <div className="flex min-h-0 flex-col overflow-auto">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">Preview (updates as you type)</p>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
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
          className={`${previewPanelClass} flex-1 overflow-auto`}
        />
      </div>
    </div>
  );
};

export const VersePerLineCompare: Story = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div>
      <p className={storyLabelClass}>versePerLine=false (default)</p>
      <UsfmPreview value={MULTI_VERSE_PARAGRAPH} className={previewPanelClass} />
    </div>
    <div>
      <p className={storyLabelClass}>versePerLine=true</p>
      <UsfmPreview value={MULTI_VERSE_PARAGRAPH} versePerLine className={previewPanelClass} />
    </div>
  </div>
);
