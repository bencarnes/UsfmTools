import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { withSystemTheme } from "../../../.storybook/with-theme-decorator.js";
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

const HYMNAL_FILE: UsfmBookPickerFileInput = {
  id: "hymnal",
  usfm: `\\id HYM
\\toc1 Hymnal
\\c 1
\\p
`,
};

const NO_ID_SAMPLE: UsfmBookPickerFileInput = {
  id: "music-supplement",
  usfm: `\\toc1 Music supplement
\\c 1
\\p
`,
};

const SAMPLE_FILES: readonly UsfmBookPickerFileInput[] = [
  ...OT_NT_FILES,
  ...OTHER_SAMPLE_FILES,
  HYMNAL_FILE,
  NO_ID_SAMPLE,
];

const meta = {
  title: "Controls/UsfmBookPicker",
  component: UsfmBookPicker,
  decorators: [withSystemTheme],
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
          className="rounded-md border border-gray-200 p-3 dark:border-gray-700"
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">Last selection: {last}</p>
      </div>
    );
  },
};
