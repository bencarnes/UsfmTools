import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  STANDARD_USFM_BOOK_IDENTIFIERS,
  type UsfmBookPickerFileInput,
} from "@usfm-tools/model";
import { UsfmBookPicker } from "./UsfmBookPicker.js";

function minimalOtNtUsfm(code: string): string {
  return `\\id ${code}
\\toc3 ${code}
\\c 1
\\p
`;
}

const OT_NT_FILES: readonly UsfmBookPickerFileInput[] =
  STANDARD_USFM_BOOK_IDENTIFIERS.filter(
    (b) => b.canonGroup === "ot" || b.canonGroup === "nt",
  ).map((b) => ({
    id: b.code,
    usfm: minimalOtNtUsfm(b.code),
  }));

const OTHER_SAMPLE_FILES: readonly UsfmBookPickerFileInput[] = [
  {
    id: "frt",
    usfm: `\\id FRT
\\toc1 Front Matter
\\c 1
\\p
`,
  },
  {
    id: "bak",
    usfm: `\\id BAK
\\toc1 Back Matter
\\c 1
\\p
`,
  },
  {
    id: "glo",
    usfm: `\\id GLO
\\toc1 Glossary
\\c 1
\\p
`,
  },
];

const SAMPLE_FILES: readonly UsfmBookPickerFileInput[] = [
  ...OT_NT_FILES,
  ...OTHER_SAMPLE_FILES,
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
      <div className="max-w-6xl space-y-3">
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
