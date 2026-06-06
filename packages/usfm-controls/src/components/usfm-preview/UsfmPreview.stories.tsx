import type { Meta, StoryObj } from "@storybook/react";
import { useArgs } from "@storybook/preview-api";
import { useState } from "react";
import { UsfmEditor } from "../usfm-editor/UsfmEditor.js";
import { UsfmPreview } from "./UsfmPreview.js";

const MULTI_VERSE_PARAGRAPH = `\\id GEN Sample
\\h Genesis
\\c 1
\\s1 The Creation
\\p \\v 1 In the beginning God created the heavens and the earth. \\v 2 Now the earth was \\nd void\\nd* and without form.`;

/** Theme-aware panel chrome for preview stories (background comes from `.usfm-preview-root`). */
const previewPanelClass =
  "max-w-prose rounded-md border border-gray-200 p-4 dark:border-gray-700";

const storyLabelClass = "mb-2 text-sm font-medium text-gray-700 dark:text-gray-300";

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
    className: previewPanelClass,
    versePerLine: false,
  },
  /** Explicit render so all `args` (including Controls) are forwarded to the component. */
  render: (args) => <UsfmPreview {...args} />,
};

export const WithEditor: Story = {
  args: {
    value: MULTI_VERSE_PARAGRAPH,
    className: "",
    versePerLine: false,
  },
  render: (args) => {
    const [, updateArgs] = useArgs();
    const [value, setValue] = useState(args.value ?? MULTI_VERSE_PARAGRAPH);
    const rawVp = args.versePerLine as unknown;
    const versePerLine = rawVp === true || rawVp === 1 || (typeof rawVp === "string" && rawVp.toLowerCase() === "true");

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
                onChange={(e) => {
                  updateArgs({ versePerLine: e.target.checked });
                }}
              />
              Verse per line
            </label>
          </div>
          <UsfmPreview
            value={value}
            versePerLine={versePerLine}
            className="max-w-prose flex-1 overflow-auto rounded-md border border-gray-200 bg-amber-50/30 p-4 dark:border-gray-700 dark:bg-amber-950/20"
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
  ),
};
